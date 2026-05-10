import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import slugify from 'slugify'
import { getDb } from '@/lib/mongo'
import { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie, getCurrentUser } from '@/lib/auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (data, status=200) => cors(NextResponse.json(data, { status }))
const err = (msg, status=400) => json({ error: msg }, status)
const clean = obj => { if (!obj) return obj; const { _id, password_hash, ...rest } = obj; return rest }
const todayIso = () => new Date().toISOString().slice(0,10)
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

async function handle(request, { params }) {
  const path = params?.path || []
  const route = '/' + path.join('/')
  const m = request.method

  try {
    const db = await getDb()

    // ---- AUTH ----
    if (route === '/auth/signup' && m === 'POST') {
      const b = await request.json()
      const required = ['full_name','email','phone','clinic_name','password']
      if (required.some(k=>!b[k])) return err('Missing fields')
      const email = b.email.toLowerCase().trim()
      if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
      const userId = uuidv4(), clinicId = uuidv4()
      const slug = slugify(b.clinic_name, { lower: true, strict: true }) + '-' + Math.floor(1000+Math.random()*9000)
      await db.collection('clinics').insertOne({
        id: clinicId, name: b.clinic_name, slug, owner_id: userId, phone: b.phone, address:'', city:'', gstin:'', logo_url:'', working_hours:null,
        subscription_plan:'free', is_active:true, onboarding_complete:false, created_at:new Date()
      })
      await db.collection('profiles').insertOne({
        id: userId, clinic_id: clinicId, email, password_hash: await hashPassword(b.password),
        full_name: b.full_name, role:'admin', phone: b.phone, profile_photo_url:'', specialization:'', registration_number:'',
        is_active:true, created_at:new Date()
      })
      setAuthCookie(signToken({ uid: userId, cid: clinicId, role:'admin' }))
      return json({ ok:true, redirect:'/onboarding' })
    }
    if (route === '/auth/login' && m === 'POST') {
      const b = await request.json()
      if (!b.email || !b.password) return err('Email and password required')
      const profile = await db.collection('profiles').findOne({ email: b.email.toLowerCase().trim() })
      if (!profile || !profile.is_active) return err('Invalid credentials', 401)
      if (!await verifyPassword(b.password, profile.password_hash)) return err('Invalid credentials', 401)
      const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
      setAuthCookie(signToken({ uid: profile.id, cid: profile.clinic_id, role: profile.role }))
      return json({ ok:true, onboarding_complete: !!clinic?.onboarding_complete })
    }
    if (route === '/auth/logout' && m === 'POST') { clearAuthCookie(); return json({ ok:true }) }
    if (route === '/auth/me' && m === 'GET') {
      const ctx = await requireUser()
      if (!ctx) return err('Unauthorized', 401)
      return json({ user:{ id: ctx.profile.id, email: ctx.profile.email }, profile: clean(ctx.profile), clinic: clean(ctx.clinic) })
    }

    // ---- ONBOARDING ----
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    const { profile, clinic } = ctx
    const cid = profile.clinic_id

    if (route === '/onboarding/clinic' && m === 'POST') {
      const b = await request.json()
      await db.collection('clinics').updateOne({ id: cid }, { $set: {
        name: b.name, address: b.address, city: b.city, phone: b.phone, gstin: b.gstin || '', logo_url: b.logo_url || ''
      }})
      return json({ ok:true })
    }
    if (route === '/onboarding/hours' && m === 'POST') {
      const b = await request.json()
      await db.collection('clinics').updateOne({ id: cid }, { $set: { working_hours: b.working_hours }})
      return json({ ok:true })
    }
    if (route === '/onboarding/team' && m === 'POST') {
      if (profile.role !== 'admin') return err('Only admin', 403)
      const b = await request.json()
      const email = (b.email||'').toLowerCase().trim()
      if (!b.full_name || !email || !b.password) return err('Missing fields')
      if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
      const newId = uuidv4()
      await db.collection('profiles').insertOne({
        id: newId, clinic_id: cid, email, password_hash: await hashPassword(b.password),
        full_name: b.full_name, role: b.role, phone:'', is_active:true, created_at:new Date()
      })
      return json({ ok:true, id:newId })
    }
    if (route === '/onboarding/complete' && m === 'POST') {
      await db.collection('clinics').updateOne({ id: cid }, { $set: { onboarding_complete: true }})
      return json({ ok:true })
    }

    // ---- PATIENTS ----
    if (route === '/patients' && m === 'GET') {
      const url = new URL(request.url)
      const q = url.searchParams.get('q')
      const filter = { clinic_id: cid, is_archived: { $ne: true } }
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i')
        filter.$or = [{ name: re }, { phone: re }]
      }
      const list = await db.collection('patients').find(filter).sort({ created_at: -1 }).limit(500).toArray()
      return json({ patients: list.map(clean) })
    }
    if (route === '/patients' && m === 'POST') {
      const b = await request.json()
      if (!b.name || !b.phone) return err('Name and phone required')
      const id = uuidv4()
      const code = 'P-' + (Date.now().toString().slice(-6))
      await db.collection('patients').insertOne({
        id, clinic_id: cid, name: b.name, phone: b.phone, age: b.age||null, gender: b.gender||'',
        blood_group: b.blood_group||'', allergies: b.allergies||'', medical_history: b.medical_history||'',
        address: b.address||'', referral_source: b.referral_source||'', patient_code: code,
        total_visits: 0, is_archived: false, created_by: profile.id, created_at: new Date()
      })
      return json({ ok:true, id })
    }
    if (path[0] === 'patients' && path[1] && m === 'GET') {
      const p = await db.collection('patients').findOne({ id: path[1], clinic_id: cid })
      if (!p) return err('Not found', 404)
      return json({ patient: clean(p) })
    }
    if (path[0] === 'patients' && path[1] && m === 'PUT') {
      const b = await request.json()
      delete b.id; delete b.clinic_id; delete b.created_at; delete b._id
      await db.collection('patients').updateOne({ id: path[1], clinic_id: cid }, { $set: b })
      return json({ ok:true })
    }

    // ---- APPOINTMENTS ----
    if (route === '/appointments' && m === 'GET') {
      const url = new URL(request.url)
      const date = url.searchParams.get('date')
      const filter = { clinic_id: cid }
      if (date) filter.appointment_date = date
      const apps = await db.collection('appointments').find(filter).sort({ appointment_time: 1 }).toArray()
      const patientIds = [...new Set(apps.map(a=>a.patient_id).filter(Boolean))]
      const patients = patientIds.length ? await db.collection('patients').find({ id: { $in: patientIds }, clinic_id: cid }).toArray() : []
      const pmap = Object.fromEntries(patients.map(p=>[p.id, p.name]))
      return json({ appointments: apps.map(a => ({ ...clean(a), patient_name: pmap[a.patient_id] || a.patient_name_temp })) })
    }
    if (route === '/appointments' && m === 'POST') {
      const b = await request.json()
      if (!b.appointment_date || !b.appointment_time) return err('Date and time required')
      const id = uuidv4()
      await db.collection('appointments').insertOne({
        id, clinic_id: cid, patient_id: b.patient_id || null, doctor_id: b.doctor_id || profile.id,
        patient_name_temp: b.patient_name_temp || '', patient_phone_temp: b.patient_phone_temp || '',
        appointment_date: b.appointment_date, appointment_time: b.appointment_time, duration_minutes: b.duration_minutes || 30,
        status: 'scheduled', appointment_type: b.appointment_type || 'consultation', chief_complaint: b.chief_complaint || '',
        notes: b.notes || '', booked_via: 'in_clinic', created_by: profile.id, created_at: new Date()
      })
      return json({ ok:true, id })
    }
    if (path[0] === 'appointments' && path[1] && m === 'PUT') {
      const b = await request.json()
      const allowed = ['status','appointment_date','appointment_time','chief_complaint','notes','appointment_type']
      const update = {}
      for (const k of allowed) if (k in b) update[k] = b[k]
      await db.collection('appointments').updateOne({ id: path[1], clinic_id: cid }, { $set: update })
      return json({ ok:true })
    }

    // ---- DASHBOARD STATS ----
    if (route === '/dashboard/stats' && m === 'GET') {
      const today = todayIso()
      const [todayAppts, totalPatients, recent] = await Promise.all([
        db.collection('appointments').find({ clinic_id: cid, appointment_date: today }).sort({ appointment_time: 1 }).toArray(),
        db.collection('patients').countDocuments({ clinic_id: cid, is_archived: { $ne: true } }),
        db.collection('patients').find({ clinic_id: cid, is_archived: { $ne: true } }).sort({ created_at: -1 }).limit(5).toArray()
      ])
      const patientIds = [...new Set(todayAppts.map(a=>a.patient_id).filter(Boolean))]
      const tps = patientIds.length ? await db.collection('patients').find({ id: { $in: patientIds }, clinic_id: cid }).toArray() : []
      const pmap = Object.fromEntries(tps.map(p=>[p.id, p.name]))
      const monthRev = await db.collection('invoices').aggregate([
        { $match: { clinic_id: cid, payment_status:'paid', created_at: { $gte: monthStart() } } },
        { $group: { _id:null, sum: { $sum: '$total_amount' } } }
      ]).toArray()
      const pending = await db.collection('invoices').countDocuments({ clinic_id: cid, payment_status:{ $in:['pending','partial'] } })
      return json({
        today_appointments: todayAppts.length,
        total_patients: totalPatients,
        monthly_revenue: monthRev[0]?.sum || 0,
        pending_invoices: pending,
        today_list: todayAppts.map(a => ({ ...clean(a), patient_name: pmap[a.patient_id] || a.patient_name_temp })),
        recent_patients: recent.map(clean),
      })
    }

    return err(`Route ${route} not found`, 404)
  } catch (e) {
    console.error('API Error:', e)
    return err('Internal server error', 500)
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
export const PATCH = handle
