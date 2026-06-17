import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import slugify from 'slugify'
import { getDb } from '@/lib/mongo'
import { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie, getCurrentUser } from '@/lib/auth'
import { sendStaffInviteEmail } from '@/lib/invite-email'
import { createAnthropicMessage } from '@/lib/anthropic-messages'
import { SMART_TYPING_SEED } from '@/lib/smart-typing-seed'
import { setupIndexes } from '@/lib/setup-indexes'
import { AWAITING_ACCEPTANCE_STATUSES, IN_PRODUCTION_STATUSES, READY_STATUSES, CLOSED_STATUSES } from '@/lib/lab-case-helpers'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }
const todayIso = () => new Date().toISOString().slice(0,10)
const yIso = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) }
const weekStart = () => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().slice(0,10) }
const monthBack = m => { const d = new Date(); d.setMonth(d.getMonth()-m); return d.toISOString().slice(0,10) }
const initials = name => (name||'').split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,3) || 'CL'

// time helpers for slot generation
const toMin = t => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim()); if (!m) return null; let h = parseInt(m[1]); const mm = parseInt(m[2]); const ap = m[3].toUpperCase(); if (ap==='PM' && h!==12) h+=12; if (ap==='AM' && h===12) h=0; return h*60+mm }
const fromMin = n => { let h = Math.floor(n/60), mm = n%60; const ap = h>=12?'PM':'AM'; let hh = h%12; if (hh===0) hh=12; return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${ap}` }
const dayNameFromIso = iso => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(iso+'T00:00:00').getDay()]

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const [profile, clinic] = await Promise.all([
    db.collection('profiles').findOne({ id: t.uid }),
    db.collection('clinics').findOne({ id: t.clinic_id })
  ])
  if (!profile) return null
  return { profile, clinic, db }
}

const clinicalAccess = p => p?.role === 'admin' || p?.role === 'doctor'
const isReceptionist = p => p?.role === 'receptionist'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

async function handle(request, { params }) {
  const path = params?.path || []
  const route = '/' + path.join('/')
  const m = request.method

  try {
    const db = await getDb()

    // ============ PUBLIC ROUTES (no auth) ============
    if (path[0] === 'public' && path[1] === 'clinic' && path[2] && !path[3] && m === 'GET') {
      const c = await db.collection('clinics').findOne({ slug: path[2], is_active: true })
      if (!c) return err('Clinic not found', 404)
      const doctors = await db.collection('profiles').find({ clinic_id: c.id, role: 'doctor', is_active: true }).toArray()
      return json({ clinic: clean(c), doctors: doctors.map(d => ({ id:d.id, full_name:d.full_name, specialization:d.specialization||'', profile_photo_url:d.profile_photo_url||'' })) })
    }
    if (path[0] === 'public' && path[1] === 'clinic' && path[2] && path[3] === 'slots' && m === 'GET') {
      const c = await db.collection('clinics').findOne({ slug: path[2], is_active: true })
      if (!c) return err('Clinic not found', 404)
      const url = new URL(request.url)
      const date = url.searchParams.get('date') || todayIso()
      const doctor_id = url.searchParams.get('doctor_id')
      const day = dayNameFromIso(date)
      const wh = (c.working_hours||[]).find(w => w.day===day)
      const slots = []
      if (wh && wh.open) {
        const startM = toMin(wh.start)||600, endM = toMin(wh.end)||1140
        for (let m = startM; m+30 <= endM; m+=30) slots.push(fromMin(m))
      }
      const f = { clinic_id: c.id, appointment_date: date, status: { $nin: ['cancelled','no_show'] } }
      if (doctor_id) f.doctor_id = doctor_id
      const taken = (await db.collection('appointments').find(f).toArray()).map(a => a.appointment_time)
      return json({ date, slots: slots.map(t => ({ time: t, taken: taken.includes(t) })) })
    }
    if (path[0] === 'public' && path[1] === 'clinic' && path[2] && path[3] === 'book' && m === 'POST') {
      const c = await db.collection('clinics').findOne({ slug: path[2], is_active: true })
      if (!c) return err('Clinic not found', 404)
      const b = await request.json()
      if (!b.name || !b.phone || !b.appointment_date || !b.appointment_time) return err('Missing fields')
      if (!/^\d{10}$/.test(b.phone)) return err('Phone must be 10 digits')
      // rate limit: max 3 per phone per day
      const sameDay = await db.collection('appointments').countDocuments({ clinic_id: c.id, patient_phone_temp: b.phone, appointment_date: b.appointment_date })
      if (sameDay >= 3) return err('Too many bookings for this number today', 429)
      // re-check slot
      const conflict = await db.collection('appointments').findOne({ clinic_id: c.id, appointment_date: b.appointment_date, appointment_time: b.appointment_time, doctor_id: b.doctor_id||null, status: { $nin:['cancelled','no_show'] } })
      if (conflict) return err('Slot already booked', 409)
      
      const id = uuidv4()
      let patient_id = null
      let patient_name_temp = null
      let patient_phone_temp = null
      let visitor_type = b.visitor_type || null
      let unmatched_note = false
      
      // Handle based on visitor_type
      if (visitor_type === 'new') {
        // CASE A: New patient - do NOT search existing patients
        patient_id = null
        patient_name_temp = b.name
        patient_phone_temp = b.phone
      } else if (visitor_type === 'returning') {
        // CASE B: Returning patient - search for existing patient
        const existingPatient = await db.collection('patients').findOne({ phone: b.phone, clinic_id: c.id })
        if (existingPatient) {
          // Step 2a: Patient found - link to existing
          patient_id = existingPatient.id
          patient_name_temp = null
          patient_phone_temp = null
        } else {
          // Step 2b: Patient not found - create with returning_unmatched
          patient_id = null
          patient_name_temp = b.name
          patient_phone_temp = b.phone
          visitor_type = 'returning_unmatched'
          unmatched_note = true
        }
      } else {
        // No visitor_type specified (old behavior) - check for existing patient
        const existingPatient = await db.collection('patients').findOne({ phone: b.phone, clinic_id: c.id })
        if (existingPatient) {
          patient_id = existingPatient.id
          patient_name_temp = null
          patient_phone_temp = null
        } else {
          patient_id = null
          patient_name_temp = b.name
          patient_phone_temp = b.phone
        }
      }
      
      await db.collection('appointments').insertOne({
        id, clinic_id: c.id, patient_id, doctor_id: b.doctor_id || null,
        patient_name_temp, patient_phone_temp,
        appointment_date: b.appointment_date, appointment_time: b.appointment_time, duration_minutes: 30,
        status: 'scheduled', appointment_type: 'consultation', chief_complaint: b.reason || '', notes: '',
        booked_via: 'online', visitor_type, created_at: new Date()
      })
      
      // WhatsApp notification (fire and forget)
      ;(async () => {
        try {
          if (!process.env.WHATSAPP_SERVICE_URL) return
          const patientPhone = b.phone
          const patientName = b.name
          if (!patientPhone) return
          const msg = `Hello ${patientName}! ✅\n\nYour appointment at ${c.name} is confirmed.\n\n📅 Date: ${b.appointment_date}\n⏰ Time: ${b.appointment_time}\n\nSee you soon!\n— ${c.name}` 
          await fetch(`${process.env.WHATSAPP_SERVICE_URL}/send`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-api-key': process.env.WHATSAPP_SERVICE_API_KEY 
            },
            body: JSON.stringify({ 
              sessionId: 'dentos_main', 
              to: patientPhone, 
              message: msg 
            })
          })
        } catch (e) {
          console.error('WhatsApp notification failed:', e.message)
        }
      })()
      
      const doctor = b.doctor_id ? await db.collection('profiles').findOne({ id: b.doctor_id }) : null
      return json({ ok:true, id, doctor_name: doctor?.full_name || '', clinic_name: c.name, clinic_phone: c.phone, clinic_city: c.city, unmatched_note })
    }

    // ============ CATALOG SEARCH (no auth) ============
    // GET /catalog/items?q=composite
    // Search master_catalog collection, return top 10 matches
    if (path[0] === 'catalog' && path[1] === 'items' && m === 'GET') {
      const url = new URL(request.url)
      const q = url.searchParams.get('q') || ''
      const category = url.searchParams.get('category') || ''
      const filter = {}
      if (q) filter.item_name = { $regex: q, $options: 'i' }
      if (category) filter.category = category
      const items = await db.collection('master_catalog').find(filter).limit(10).toArray()
      return json({ items: items.map(clean) })
    }

    // GET /catalog/treatments?q=root
    // Search master_treatments collection
    if (path[0] === 'catalog' && path[1] === 'treatments' && m === 'GET') {
      const url = new URL(request.url)
      const q = url.searchParams.get('q') || ''
      const filter = q ? { treatment_name: { $regex: q, $options: 'i' } } : {}
      const treatments = await db.collection('master_treatments').find(filter).limit(15).toArray()
      return json({ treatments: treatments.map(clean) })
    }

    // ============ LAB CASES BY NUMBER (WhatsApp integration) ============
    if (path[0] === 'lab-cases' && path[1] === 'by-number' && path[2] && m === 'PATCH') {
      const caseNumber = path[2].toUpperCase()
      const b = await request.json()
      const allowedStatuses = ['lab_received', 'ready', 'sent', 'completed']
      if (!allowedStatuses.includes(b.status)) return err('Invalid status', 400)
      
      const labCase = await db.collection('lab_cases').findOne({ case_number: caseNumber })
      if (!labCase) return err('Lab case not found', 404)
      
      await db.collection('lab_cases').updateOne(
        { case_number: caseNumber },
        { 
          $set: { status: b.status, updated_at: new Date() },
          $push: { 
            update_log: { 
              status: b.status, 
              updated_via: b.updated_via || 'whatsapp',
              timestamp: new Date() 
            } 
          }
        }
      )
      
      return json({ ok: true, case_number: caseNumber, status: b.status })
    }
    if (path[0] === 'lab-cases' && path[1] === 'by-number' && path[2] && m === 'GET') {
      const caseNumber = path[2].toUpperCase()
      const labCase = await db.collection('lab_cases').findOne({ case_number: caseNumber })
      if (!labCase) return err('Lab case not found', 404)
      return json({ lab_case: clean(labCase) })
    }

    // ============ AUTH ============
    if (route === '/auth/signup' && m === 'POST') {
      const b = await request.json()
      const required = ['full_name','email','phone','clinic_name','password']
      if (required.some(k=>!b[k])) return err('Missing fields')
      const email = b.email.toLowerCase().trim()
      if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
      const userId = uuidv4(), clinicId = uuidv4()
      const slug = slugify(b.clinic_name, { lower: true, strict: true }) + '-' + Math.floor(1000+Math.random()*9000)
      await db.collection('clinics').insertOne({ id: clinicId, name: b.clinic_name, slug, owner_id: userId, phone: b.phone, address:'', city:'', gstin:'', logo_url:'', working_hours:null, subscription_plan:'free', is_active:true, onboarding_complete:false, created_at:new Date() })
      await db.collection('profiles').insertOne({ id: userId, clinic_id: clinicId, email, password_hash: await hashPassword(b.password), full_name: b.full_name, role:'admin', phone: b.phone, is_active:true, created_at:new Date() })
      const now = new Date()
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      await db.collection('subscriptions').insertOne({
        clinic_id: clinicId,
        subscription_status: 'trial',
        plan_type: null,
        trial_start: now,
        trial_end: trialEnd,
        razorpay_subscription_id: null,
        razorpay_plan_id: null,
        razorpay_customer_id: null,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        cancelled_at: null,
        grace_period_end: null,
        last_payment_date: null,
        last_payment_amount: null,
        created_at: now,
        updated_at: now
      })
      setAuthCookie(signToken({ uid: userId, cid: clinicId, role:'admin' }))
      return json({ ok:true })
    }
    if (route === '/auth/login' && m === 'POST') {
      const b = await request.json()
      if (!b.email || !b.password) return err('Email and password required')
      const profile = await db.collection('profiles').findOne({ email: b.email.toLowerCase().trim() })
      if (!profile || !profile.is_active) return err('Invalid credentials', 401)
      if (!await verifyPassword(b.password, profile.password_hash)) return err('Invalid credentials', 401)
      const c = await db.collection('clinics').findOne({ id: profile.clinic_id })
      await db.collection('profiles').updateOne({ id: profile.id }, { $set: { last_login_at: new Date() } })
      setAuthCookie(signToken({ uid: profile.id, cid: profile.clinic_id, role: profile.role }))
      return json({ ok:true, onboarding_complete: !!c?.onboarding_complete })
    }
    if (route === '/auth/logout' && m === 'POST') { clearAuthCookie(); return json({ ok:true }) }
    if (route === '/auth/me' && m === 'GET') {
      const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
      return json({ user:{ id: ctx.profile.id, email: ctx.profile.email }, profile: clean(ctx.profile), clinic: clean(ctx.clinic) })
    }

    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, clinic } = ctx; const cid = profile.clinic_id

    // ============ ONBOARDING ============
    if (route === '/onboarding/clinic' && m === 'POST') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      await db.collection('clinics').updateOne({ id: cid }, { $set: { name: b.name, address: b.address, city: b.city, phone: b.phone, gstin: b.gstin || '', logo_url: b.logo_url || '' }})
      return json({ ok:true })
    }
    if (route === '/onboarding/hours' && m === 'POST') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      await db.collection('clinics').updateOne({ id: cid }, { $set: { working_hours: b.working_hours }})
      return json({ ok:true })
    }
    if (route === '/onboarding/team' && m === 'POST') {
      if (!clinicalAccess(profile)) return err('Forbidden', 403)
      const b = await request.json(); const email = (b.email||'').toLowerCase().trim()
      if (!b.full_name || !email || !b.password) return err('Missing fields')
      if (!b.role || !['doctor', 'receptionist'].includes(b.role)) return err('Role must be doctor or receptionist', 400)
      if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
      const newId = uuidv4()
      await db.collection('profiles').insertOne({ id: newId, clinic_id: cid, email, password_hash: await hashPassword(b.password), full_name: b.full_name, role: b.role, phone:'', is_active:true, created_at:new Date() })
      const origin = new URL(request.url).origin
      const emailResult = await sendStaffInviteEmail({
        to: email,
        staffName: b.full_name,
        clinicName: clinic?.name,
        temporaryPassword: b.password,
        loginUrl: `${origin}/login`,
      })
      return json({ ok:true, id:newId, invite_email_sent: !!emailResult?.sent })
    }
    if (route === '/onboarding/complete' && m === 'POST') {
      await db.collection('clinics').updateOne({ id: cid }, { $set: { onboarding_complete: true }})
      return json({ ok:true })
    }

    // ============ CLINIC SETTINGS ============
    if (route === '/clinic' && m === 'PUT') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      const allowed = ['name','phone','address','city','gstin','logo_url','working_hours','slug']
      const update = {}
      for (const k of allowed) if (k in b) update[k] = b[k]
      // ensure slug uniqueness
      if (update.slug) {
        const s = slugify(update.slug, { lower: true, strict: true })
        const exists = await db.collection('clinics').findOne({ slug: s, id: { $ne: cid } })
        if (exists) return err('Slug already in use')
        update.slug = s
      }
      await db.collection('clinics').updateOne({ id: cid }, { $set: update })
      return json({ ok:true })
    }

    // ============ DOCTORS / PROFILES (TEAM) ============
    if (route === '/doctors' && m === 'GET') {
      const docs = await db.collection('profiles').find({ clinic_id: cid, role: 'doctor', is_active: true }).toArray()
      return json({ doctors: docs.map(d => ({ id:d.id, full_name:d.full_name, specialization:d.specialization||'', profile_photo_url:d.profile_photo_url||'' })) })
    }
    if (route === '/team' && m === 'GET') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const team = await db.collection('profiles').find({ clinic_id: cid }).toArray()
      return json({ team: team.map(clean) })
    }
    if (route === '/team' && m === 'POST') {
      if (!clinicalAccess(profile)) return err('Forbidden', 403)
      const b = await request.json(); const email = (b.email||'').toLowerCase().trim()
      if (!b.full_name || !email || !b.password || !b.role) return err('Missing fields')
      if (!['doctor', 'receptionist'].includes(b.role)) return err('Role must be doctor or receptionist', 400)
      if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
      const id = uuidv4()
      await db.collection('profiles').insertOne({ id, clinic_id: cid, email, password_hash: await hashPassword(b.password), full_name: b.full_name, role: b.role, phone:'', whatsapp_number: b.whatsapp_number || '', is_active:true, created_at:new Date() })
      const origin = new URL(request.url).origin
      const emailResult = await sendStaffInviteEmail({
        to: email,
        staffName: b.full_name,
        clinicName: clinic?.name,
        temporaryPassword: b.password,
        loginUrl: `${origin}/login`,
      })
      return json({ ok:true, id, invite_email_sent: !!emailResult?.sent })
    }
    if (path[0] === 'team' && path[1] && m === 'PUT') {
      if (!clinicalAccess(profile)) return err('Forbidden', 403)
      const b = await request.json(); const update = {}
      if ('role' in b) {
        if (!['admin', 'doctor', 'receptionist'].includes(b.role)) return err('Invalid role', 400)
        update.role = b.role
      }
      if ('is_active' in b) update.is_active = b.is_active
      if ('whatsapp_number' in b) update.whatsapp_number = b.whatsapp_number
      await db.collection('profiles').updateOne({ id: path[1], clinic_id: cid }, { $set: update })
      return json({ ok:true })
    }

    // ============ TREATMENT TEMPLATES ============
    if (route === '/treatment_templates' && m === 'GET') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const list = await db.collection('treatment_templates').find({ clinic_id: cid }).sort({ name: 1 }).toArray()
      return json({ templates: list.map(clean) })
    }
    if (route === '/treatment_templates' && m === 'POST') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      if (!b.name) return err('Name required')
      const id = uuidv4()
      await db.collection('treatment_templates').insertOne({ id, clinic_id: cid, name: b.name, default_notes: b.default_notes||'', default_price: parseFloat(b.default_price)||0, category: b.category||'', created_at: new Date() })
      return json({ ok:true, id })
    }
    if (path[0]==='treatment_templates' && path[1] && m==='PUT') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json(); const u = {}
      for (const k of ['name','default_notes','default_price','category']) if (k in b) u[k] = k==='default_price'?parseFloat(b[k])||0:b[k]
      await db.collection('treatment_templates').updateOne({ id: path[1], clinic_id: cid }, { $set: u })
      return json({ ok:true })
    }
    if (path[0]==='treatment_templates' && path[1] && m==='DELETE') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      await db.collection('treatment_templates').deleteOne({ id: path[1], clinic_id: cid })
      return json({ ok:true })
    }

    // ============ PATIENTS ============
    if (route === '/patients' && m === 'GET') {
      const url = new URL(request.url)
      const q = url.searchParams.get('q'); const filter = url.searchParams.get('filter')
      const f = { clinic_id: cid, is_archived: { $ne: true } }
      if (q) { const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i'); f.$or = [{ name: re }, { phone: re }, { patient_code: re }] }
      if (filter === 'week') f.last_visit_date = { $gte: weekStart() }
      else if (filter === 'month') f.last_visit_date = { $gte: monthBack(1) }
      else if (filter === 'inactive') f.$and = [{ $or: [{ last_visit_date: { $lt: monthBack(3) } }, { last_visit_date: null }] }]
      const list = await db.collection('patients').find(f).sort({ created_at: -1 }).limit(500).toArray()
      return json({ patients: list.map(clean) })
    }
    if (route === '/patients' && m === 'POST') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      if (!b.name || !b.phone) return err('Name and phone required')
      const id = uuidv4()
      const count = await db.collection('patients').countDocuments({ clinic_id: cid })
      const code = 'PT' + String(count + 1).padStart(5,'0')
      await db.collection('patients').insertOne({ id, clinic_id: cid, name: b.name, phone: b.phone, dob: b.dob||null, age: b.age||null, gender: b.gender||'', blood_group: b.blood_group||'', allergies: b.allergies||'', medical_history: b.medical_history||'', address: b.address||'', referral_source: b.referral_source||'', patient_code: code, total_visits: 0, is_archived: false, created_by: profile.id, created_at: new Date() })
      return json({ ok:true, id })
    }
    if (path[0] === 'patients' && path[1] && m === 'GET') {
      const p = await db.collection('patients').findOne({ id: path[1], clinic_id: cid })
      if (!p) return err('Not found', 404)
      return json({ patient: clean(p) })
    }
    if (path[0] === 'patients' && path[1] && m === 'PUT') {
      const b = await request.json(); delete b.id; delete b.clinic_id; delete b.created_at; delete b._id
      if (isReceptionist(profile)) {
        delete b.allergies
        delete b.medical_history
      }
      await db.collection('patients').updateOne({ id: path[1], clinic_id: cid }, { $set: b })
      return json({ ok:true })
    }
    if (path[0] === 'patients' && path[1] && m === 'DELETE') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const p = await db.collection('patients').findOne({ id: path[1], clinic_id: cid })
      if (!p) return err('Not found', 404)
      // Delete related records
      await db.collection('visits').deleteMany({ patient_id: path[1], clinic_id: cid })
      await db.collection('appointments').deleteMany({ patient_id: path[1], clinic_id: cid })
      await db.collection('prescriptions').deleteMany({ patient_id: path[1], clinic_id: cid })
      await db.collection('patients').deleteOne({ id: path[1], clinic_id: cid })
      return json({ ok:true })
    }

    // ============ APPOINTMENTS ============
    if (route === '/appointments' && m === 'GET') {
      const url = new URL(request.url)
      const date = url.searchParams.get('date'); const patient_id = url.searchParams.get('patient_id')
      const f = { clinic_id: cid }
      if (date) f.appointment_date = date
      if (patient_id) f.patient_id = patient_id
      const apps = await db.collection('appointments').find(f).sort({ appointment_date: -1, appointment_time: 1 }).toArray()
      const pids = [...new Set(apps.map(a=>a.patient_id).filter(Boolean))]
      const dids = [...new Set(apps.map(a=>a.doctor_id).filter(Boolean))]
      const [pts, docs] = await Promise.all([
        pids.length ? db.collection('patients').find({ id: { $in: pids }, clinic_id: cid }).toArray() : [],
        dids.length ? db.collection('profiles').find({ id: { $in: dids }, clinic_id: cid }).toArray() : []
      ])
      const pmap = Object.fromEntries(pts.map(p=>[p.id,{name:p.name,phone:p.phone,total_visits:p.total_visits||0}]))
      const dmap = Object.fromEntries(docs.map(d=>[d.id,d.full_name]))
      const visits = await db.collection('visits').find({ clinic_id: cid, appointment_id: { $in: apps.map(a=>a.id) } }).toArray()
      const vmap = Object.fromEntries(visits.map(v=>[v.appointment_id, v.id]))
      return json({ appointments: apps.map(a => ({ ...clean(a), patient_name: pmap[a.patient_id]?.name||a.patient_name_temp, patient_phone: pmap[a.patient_id]?.phone||a.patient_phone_temp, patient_total_visits: pmap[a.patient_id]?.total_visits||0, doctor_name: dmap[a.doctor_id]||'', visit_id: vmap[a.id] || null })) })
    }
    if (route === '/appointments' && m === 'POST') {
      const b = await request.json()
      if (!b.appointment_date || !b.appointment_time) return err('Date and time required')
      const id = uuidv4()
      await db.collection('appointments').insertOne({ id, clinic_id: cid, patient_id: b.patient_id||null, doctor_id: b.doctor_id||profile.id, patient_name_temp: b.patient_name_temp||'', patient_phone_temp: b.patient_phone_temp||'', appointment_date: b.appointment_date, appointment_time: b.appointment_time, duration_minutes: b.duration_minutes||30, status:'scheduled', appointment_type: b.appointment_type||'consultation', chief_complaint: b.chief_complaint||'', notes: b.notes||'', booked_via: b.booked_via||'in_clinic', created_by: profile.id, created_at: new Date() })
      
      // WhatsApp notification (fire and forget)
      ;(async () => {
        try {
          if (!process.env.WHATSAPP_SERVICE_URL) return
          let patientPhone = b.patient_phone_temp
          let patientName = b.patient_name_temp
          if (b.patient_id) {
            const pt = await db.collection('patients').findOne({ id: b.patient_id })
            patientPhone = pt?.phone
            patientName = pt?.name
          }
          if (!patientPhone) return
          const clinicDoc = await db.collection('clinics').findOne({ id: cid })
          const msg = `Hello ${patientName}! ✅\n\nYour appointment at ${clinicDoc?.name} is confirmed.\n\n📅 Date: ${b.appointment_date}\n⏰ Time: ${b.appointment_time}\n\nSee you soon!\n— ${clinicDoc?.name}` 
          await fetch(`${process.env.WHATSAPP_SERVICE_URL}/send`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-api-key': process.env.WHATSAPP_SERVICE_API_KEY 
            },
            body: JSON.stringify({ 
              sessionId: 'dentos_main', 
              to: patientPhone, 
              message: msg 
            })
          })
        } catch (e) {
          console.error('WhatsApp notification failed:', e.message)
        }
      })()
      
      return json({ ok:true, id })
    }
    if (path[0] === 'appointments' && path[1] && m === 'PUT') {
      const b = await request.json()
      const allowed = ['status','appointment_date','appointment_time','chief_complaint','notes','appointment_type','doctor_id','duration_minutes']
      const update = {}
      for (const k of allowed) if (k in b) update[k] = b[k]
      await db.collection('appointments').updateOne({ id: path[1], clinic_id: cid }, { $set: update })
      return json({ ok:true })
    }

    // ============ VISITS ============
    if (route === '/visits' && m === 'POST') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      if (!b.patient_id && b.appointment_id) {

        const appointment = await db.collection('appointments').findOne({
          id: b.appointment_id,
          clinic_id: cid
        })
      
        if (appointment) {
          let patientId = null
          
          // Handle based on visitor_type
          if (appointment.visitor_type === 'new') {
            // CASE: visitor_type = "new" - NEVER check phone, always create new patient
            patientId = uuidv4()
            const count = await db.collection('patients').countDocuments({
              clinic_id: cid
            })
            const code = 'PT' + String(count + 1).padStart(5,'0')
            await db.collection('patients').insertOne({
              id: patientId,
              clinic_id: cid,
              name: appointment.patient_name_temp || 'Unknown',
              phone: appointment.patient_phone_temp || '',
              patient_code: code,
              total_visits: 0,
              is_archived: false,
              created_by: profile.id,
              created_at: new Date()
            })
            await db.collection('appointments').updateOne(
              { id: appointment.id },
              { $set: { patient_id: patientId } }
            )
          } else if (appointment.visitor_type === 'returning_unmatched') {
            // CASE: visitor_type = "returning_unmatched" - return error to show modal
            return err('returning_unmatched', 400)
          } else {
            // CASE: visitor_type = "returning" with patient_id already set, or visitor_type = null (old behavior)
            if (appointment.patient_id) {
              // If patient_id is already set, use it
              patientId = appointment.patient_id
            } else {
              // Otherwise check for existing patient by phone
              if (appointment.patient_phone_temp) {
                const existingPatient = await db.collection('patients').findOne({
                  phone: appointment.patient_phone_temp,
                  clinic_id: cid
                })
                if (existingPatient) {
                  patientId = existingPatient.id
                  // Update appointment to link to existing patient
                  await db.collection('appointments').updateOne(
                    { id: appointment.id },
                    { $set: { patient_id: patientId } }
                  )
                }
              }
              
              // If no existing patient found, create new one
              if (!patientId) {
                patientId = uuidv4()
                const count = await db.collection('patients').countDocuments({
                  clinic_id: cid
                })
                const code = 'PT' + String(count + 1).padStart(5,'0')
                await db.collection('patients').insertOne({
                  id: patientId,
                  clinic_id: cid,
                  name: appointment.patient_name_temp || 'Unknown',
                  phone: appointment.patient_phone_temp || '',
                  patient_code: code,
                  total_visits: 0,
                  is_archived: false,
                  created_by: profile.id,
                  created_at: new Date()
                })
                await db.collection('appointments').updateOne(
                  { id: appointment.id },
                  { $set: { patient_id: patientId } }
                )
              }
            }
          }
          b.patient_id = patientId
        }
      }
      
      if (!b.patient_id) return err('patient_id required') 
      const id = uuidv4()
      await db.collection('visits').insertOne({ id, clinic_id: cid, patient_id: b.patient_id, doctor_id: b.doctor_id||profile.id, appointment_id: b.appointment_id||null, visit_date: todayIso(), chief_complaint: b.chief_complaint||'', clinical_notes:'', diagnosis:'', treatment_done:'', treatment_plan:'', next_visit_recommended:false, next_visit_date:null, created_at:new Date() })
      if (b.appointment_id) await db.collection('appointments').updateOne({ id: b.appointment_id, clinic_id: cid }, { $set: { status: 'in_progress' }})
      return json({ ok:true, id })
    }
    if (route === '/visits' && m === 'GET') {
      const url = new URL(request.url); const patient_id = url.searchParams.get('patient_id')
      const f = { clinic_id: cid }; if (patient_id) f.patient_id = patient_id
      const list = await db.collection('visits').find(f).sort({ visit_date: -1, created_at: -1 }).toArray()
      const uniqueList = Array.from(new Map(list.map(v => [v.id, v])).values())
      const dids = [...new Set(uniqueList.map(v=>v.doctor_id).filter(Boolean))]
      const docs = dids.length ? await db.collection('profiles').find({ id: { $in: dids }, clinic_id: cid }).toArray() : []
      const dmap = Object.fromEntries(docs.map(d=>[d.id,d.full_name]))
      const rxs = await db.collection('prescriptions').find({ clinic_id: cid, visit_id: { $in: uniqueList.map(v=>v.id) } }).toArray()
      const rxmap = {}; for (const r of rxs) (rxmap[r.visit_id] = rxmap[r.visit_id]||[]).push(clean(r))
      return json({ visits: uniqueList.map(v => { const { prescriptions: _vRx, ...cleanV } = clean(v); return { ...cleanV, doctor_name: dmap[v.doctor_id]||'', prescriptions: rxmap[v.id]||[] } }) })
    }
    if (path[0]==='visits' && path[1] && m==='GET') {
      const v = await db.collection('visits').findOne({ id: path[1], clinic_id: cid })
      if (!v) return err('Not found', 404)
      const [p, doc, rxs, prevList, inv] = await Promise.all([
        db.collection('patients').findOne({ id: v.patient_id, clinic_id: cid }),
        v.doctor_id ? db.collection('profiles').findOne({ id: v.doctor_id, clinic_id: cid }) : null,
        db.collection('prescriptions').find({ visit_id: v.id, clinic_id: cid }).toArray(),
        db.collection('visits').find({ patient_id: v.patient_id, clinic_id: cid, id: { $ne: v.id } }).sort({ visit_date: -1, created_at: -1 }).limit(1).toArray(),
        db.collection('invoices').findOne({ visit_id: v.id, clinic_id: cid })
      ])
      const items = inv ? await db.collection('invoice_items').find({ invoice_id: inv.id, clinic_id: cid }).toArray() : []
      const { items: _invItems, ...cleanInv } = inv ? clean(inv) : {}
      const { prescriptions: _vRx, ...cleanV } = clean(v)
      return json({ visit: { ...cleanV, patient: clean(p), doctor_name: doc?.full_name||'', prescriptions: rxs.map(clean), previous_visit: prevList[0] ? clean(prevList[0]) : null, invoice: inv ? { ...cleanInv, items: items.map(clean) } : null } })
    }
    if (path[0]==='visits' && path[1] && m==='PUT') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      const allowed = ['chief_complaint','clinical_notes','diagnosis','treatment_done','treatment_plan','next_visit_recommended','next_visit_date']
      const update = {}
      for (const k of allowed) if (k in b) update[k] = b[k]
      await db.collection('visits').updateOne({ id: path[1], clinic_id: cid }, { $set: update })
      // replace prescriptions
      if (Array.isArray(b.prescriptions)) {
        await db.collection('prescriptions').deleteMany({ visit_id: path[1], clinic_id: cid })
        const valid = b.prescriptions.filter(r => r.medicine_name?.trim())
        if (valid.length) {
          await db.collection('prescriptions').insertMany(valid.map(r => ({ id: uuidv4(), clinic_id: cid, visit_id: path[1], medicine_name: r.medicine_name, dosage: r.dosage||'', frequency: r.frequency||'', duration: r.duration||'', instructions: r.instructions||'', created_at: new Date() })))
        }
      }
      // upsert invoice items + invoice (draft mode)
      const visit = await db.collection('visits').findOne({ id: path[1], clinic_id: cid })
      let invoiceId = null
      if (Array.isArray(b.invoice_items) || b.invoice) {
        const existing = await db.collection('invoices').findOne({ visit_id: path[1], clinic_id: cid })
        const items = (b.invoice_items||[]).filter(it => it.description?.trim())
        const subtotal = items.reduce((s,it)=> s + (parseFloat(it.unit_price)||0)*(parseInt(it.quantity)||1), 0)
        const discount = parseFloat(b.discount)||0
        const gst = b.gst_enabled ? Math.round((subtotal-discount)*0.18*100)/100 : 0
        const total = Math.max(0, subtotal - discount + gst)
        const invoiceData = { subtotal, discount, gst_amount: gst, total_amount: total, payment_status: b.payment_status||'pending', payment_mode: b.payment_mode||null, notes: b.invoice_notes||'' }
        if (existing) {
          await db.collection('invoices').updateOne({ id: existing.id }, { $set: invoiceData })
          await db.collection('invoice_items').deleteMany({ invoice_id: existing.id, clinic_id: cid })
          invoiceId = existing.id
        } else {
          invoiceId = uuidv4()
          const count = await db.collection('invoices').countDocuments({ clinic_id: cid })
          const invoice_number = `INV-${initials(clinic.name)}-${String(count+1).padStart(5,'0')}`
          const share_token = uuidv4()
          await db.collection('invoices').insertOne({ id: invoiceId, clinic_id: cid, patient_id: visit.patient_id, visit_id: visit.id, invoice_number, invoice_date: todayIso(), share_token, ...invoiceData, created_at: new Date() })
        }
        if (items.length) {
          await db.collection('invoice_items').insertMany(items.map(it => ({ id: uuidv4(), clinic_id: cid, invoice_id: invoiceId, description: it.description, quantity: parseInt(it.quantity)||1, unit_price: parseFloat(it.unit_price)||0, total: (parseFloat(it.unit_price)||0)*(parseInt(it.quantity)||1) })))
        }
      }
      // complete-visit side effects
      if (b.complete) {
        if (!visit.chief_complaint && !b.chief_complaint) return err('Chief complaint required to complete')
        if (visit?.appointment_id) await db.collection('appointments').updateOne({ id: visit.appointment_id, clinic_id: cid }, { $set: { status: 'completed' }})
        await db.collection('patients').updateOne({ id: visit.patient_id, clinic_id: cid }, { $set: { last_visit_date: visit.visit_date, next_followup_date: b.next_visit_recommended ? b.next_visit_date : null }, $inc: { total_visits: 1 } })
      }
      return json({ ok:true, invoice_id: invoiceId })
    }

    // ============ TOOTH CHART ============
    // GET /visits/:id/tooth-chart — get tooth chart for a visit
    if (path[0]==='visits' && path[1] && path[2]==='tooth-chart' && m==='GET') {
      const chart = await db.collection('tooth_charts').findOne({ 
        visit_id: path[1], clinic_id: cid 
      })
      return json({ chart: chart ? clean(chart) : null })
    }
    // PUT /visits/:id/tooth-chart — save tooth chart for a visit
    if (path[0]==='visits' && path[1] && path[2]==='tooth-chart' && m==='PUT') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      const existing = await db.collection('tooth_charts').findOne({ 
        visit_id: path[1], clinic_id: cid 
      })
      if (existing) {
        await db.collection('tooth_charts').updateOne(
          { visit_id: path[1], clinic_id: cid },
          { $set: { teeth: b.teeth, last_updated: new Date(), updated_by: profile.id } }
        )
      } else {
        await db.collection('tooth_charts').insertOne({
          id: uuidv4(),
          visit_id: path[1],
          clinic_id: cid,
          patient_id: b.patient_id,
          teeth: b.teeth,
          last_updated: new Date(),
          updated_by: profile.id,
          created_at: new Date()
        })
      }
      return json({ ok: true })
    }

    // ============ PUBLIC INVOICE ============
    if (path[0] === 'public' && path[1] === 'invoice' && path[2] && m === 'GET') {
      const inv = await db.collection('invoices').findOne({ share_token: path[2] })
      if (!inv) return err('Not found', 404)
      const clinic = await db.collection('clinics').findOne({ id: inv.clinic_id })
      if (!clinic) return err('Clinic not found', 404)
      const [p, items, visit] = await Promise.all([
        db.collection('patients').findOne({ id: inv.patient_id }),
        db.collection('invoice_items').find({ invoice_id: inv.id }).toArray(),
        db.collection('visits').findOne({ id: inv.visit_id })
      ])
      const doctor = visit?.doctor_id ? await db.collection('profiles').findOne({ id: visit.doctor_id }) : null
      const { items: _invItems, ...cleanInv } = clean(inv)
      return json({ invoice: { ...cleanInv, patient: clean(p), items: items.map(clean), visit: visit ? clean(visit) : null, doctor_name: doctor?.full_name || '', clinic: clean(clinic) } })
    }

    // ============ INVOICES ============
    if (route === '/invoices' && m === 'GET') {
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const from = url.searchParams.get('from'); const to = url.searchParams.get('to')
      const q = url.searchParams.get('q')
      const f = { clinic_id: cid }
      if (status && status !== 'all') f.payment_status = status
      if (from || to) { f.invoice_date = {}; if (from) f.invoice_date.$gte = from; if (to) f.invoice_date.$lte = to }
      const list = await db.collection('invoices').find(f).sort({ invoice_date: -1, created_at: -1 }).toArray()
      const pids = [...new Set(list.map(i=>i.patient_id).filter(Boolean))]
      const pts = pids.length ? await db.collection('patients').find({ id: { $in: pids }, clinic_id: cid }).toArray() : []
      let pmap = Object.fromEntries(pts.map(p=>[p.id, p.name]))
      let arr = list.map(i => ({ ...clean(i), patient_name: pmap[i.patient_id] || '—' }))
      if (q) { const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i'); arr = arr.filter(i => re.test(i.patient_name) || re.test(i.invoice_number||'')) }
      // monthly summary
      const mStart = monthBack(1)
      const monthInv = await db.collection('invoices').find({ clinic_id: cid, invoice_date: { $gte: mStart } }).toArray()
      const summary = {
        collected: monthInv.filter(i=>i.payment_status==='paid').reduce((s,i)=>s+(i.total_amount||0),0),
        pending: monthInv.filter(i=>['pending','partial'].includes(i.payment_status)).reduce((s,i)=>s+(i.total_amount||0),0),
        total: monthInv.reduce((s,i)=>s+(i.total_amount||0),0),
      }
      return json({ invoices: arr, summary })
    }
    if (path[0]==='invoices' && path[1] && m==='GET') {
      const inv = await db.collection('invoices').findOne({ id: path[1], clinic_id: cid })
      if (!inv) return err('Not found', 404)
      const [p, items, visit] = await Promise.all([
        db.collection('patients').findOne({ id: inv.patient_id, clinic_id: cid }),
        db.collection('invoice_items').find({ invoice_id: inv.id, clinic_id: cid }).toArray(),
        inv.visit_id ? db.collection('visits').findOne({ id: inv.visit_id, clinic_id: cid }) : null,
      ])
      const doctor = visit?.doctor_id ? await db.collection('profiles').findOne({ id: visit.doctor_id, clinic_id: cid }) : null
      const { items: _invItems, ...cleanInv } = clean(inv)
      return json({ invoice: { ...cleanInv, patient: clean(p), items: items.map(clean), visit: visit ? clean(visit) : null, doctor_name: doctor?.full_name || '', clinic: clean(clinic) } })
    }
    if (path[0]==='invoices' && path[1] && m==='PUT') {
      const b = await request.json(); const u = {}
      if ('payment_status' in b) u.payment_status = b.payment_status
      if ('payment_mode' in b) u.payment_mode = b.payment_mode
      if ('notes' in b) u.notes = b.notes
      await db.collection('invoices').updateOne({ id: path[1], clinic_id: cid }, { $set: u })
      return json({ ok:true })
    }
    if (path[0]==='invoices' && path[1] && m==='PATCH') {
      const b = await request.json()
      if (b.generate_share_token) {
        const inv = await db.collection('invoices').findOne({ id: path[1], clinic_id: cid })
        if (!inv) return err('Not found', 404)
        if (!inv.share_token) {
          const share_token = uuidv4()
          await db.collection('invoices').updateOne({ id: path[1], clinic_id: cid }, { $set: { share_token } })
        }
        return json({ ok:true })
      }
      return err('Invalid request')
    }
    if (path[0]==='invoices' && path[1] && m==='DELETE') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const inv = await db.collection('invoices').findOne({ id: path[1], clinic_id: cid })
      if (!inv) return err('Not found', 404)
      await db.collection('invoice_items').deleteMany({ invoice_id: inv.id, clinic_id: cid })
      await db.collection('invoices').deleteOne({ id: inv.id, clinic_id: cid })
      return json({ ok:true })
    }

    // ============ PATIENT OUTSTANDING BALANCE ============
    if (path[0] === 'patients' && path[1] === 'outstanding-balance' && m === 'GET') {
      const url = new URL(request.url)
      const patientId = url.searchParams.get('patient_id')
      if (!patientId) return err('patient_id required')
      
      const invoices = await db.collection('invoices').find({
        patient_id: patientId,
        clinic_id: cid,
        payment_status: { $in: ['pending', 'partial'] }
      }).sort({ invoice_date: -1 }).toArray()
      
      const unpaidInvoices = invoices.map(inv => {
        const totalAmount = Number(inv.total_amount || 0)
        return {
          _id: inv.id,
          invoice_number: inv.invoice_number,
          date: inv.invoice_date,
          pending_amount: totalAmount,
          payment_status: inv.payment_status
        }
      })
      
      const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + inv.pending_amount, 0)
      
      return json({
        outstandingBalance,
        unpaidInvoices
      })
    }

    // ============ SMART TYPING ============
    if (path[0] === 'smart-typing' && path[1] === 'seed' && m === 'POST') {
      const count = await db.collection('smart_typing_templates').countDocuments()
      if (count >= 331) return json({ ok: true, message: 'Already seeded' })
      await db.collection('smart_typing_templates').insertMany(
        SMART_TYPING_SEED.map(t => ({ ...t, clinic_id: null, is_custom: false }))
      )
      return json({ ok: true, seeded: 331 })
    }

    // ============ SETUP INDEXES ============
    if (path[0] === 'setup-indexes' && m === 'POST') {
      await setupIndexes()
      return json({ ok: true, message: 'Indexes created successfully' })
    }
    if (path[0] === 'smart-typing' && m === 'GET') {
      const url = new URL(request.url)
      const q = url.searchParams.get('q') || ''
      const category = url.searchParams.get('category') || ''
      const clinicId = url.searchParams.get('clinic_id')
      
      if (!q) return json({ templates: [] })
      
      const templates = await db.collection('smart_typing_templates').find({
        $or: [
          { trigger: { $regex: q, $options: 'i' } },
          { expansion: { $regex: q, $options: 'i' } }
        ],
        ...(category ? { category } : {}),
        $or: [
          { clinic_id: null },
          ...(clinicId ? [{ clinic_id }] : [])
        ]
      }).limit(6).toArray()
      
      // Sort by exact trigger match first, then partial, then text match
      const sorted = templates.sort((a, b) => {
        const aExact = a.trigger.toLowerCase() === q.toLowerCase()
        const bExact = b.trigger.toLowerCase() === q.toLowerCase()
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        const aStarts = a.trigger.toLowerCase().startsWith(q.toLowerCase())
        const bStarts = b.trigger.toLowerCase().startsWith(q.toLowerCase())
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return 0
      })
      
      return json({ templates: sorted })
    }

    // ============ DASHBOARD STATS ============
    if (route === '/dashboard/stats' && m === 'GET') {
      const today = todayIso(); const yest = yIso()
      const [todayAppts, doneToday, doneYest] = await Promise.all([
        db.collection('appointments').find({ clinic_id: cid, appointment_date: today }).sort({ appointment_time: 1 }).toArray(),
        db.collection('appointments').countDocuments({ clinic_id: cid, appointment_date: today, status: 'completed' }),
        db.collection('appointments').countDocuments({ clinic_id: cid, appointment_date: yest, status: 'completed' })
      ])
      const pids = [...new Set(todayAppts.map(a=>a.patient_id).filter(Boolean))]
      const dids = [...new Set(todayAppts.map(a=>a.doctor_id).filter(Boolean))]
      const [pts, docs, visits] = await Promise.all([
        pids.length ? db.collection('patients').find({ id: { $in: pids }, clinic_id: cid }).toArray() : [],
        dids.length ? db.collection('profiles').find({ id: { $in: dids }, clinic_id: cid }).toArray() : [],
        db.collection('visits').find({ clinic_id: cid, appointment_id: { $in: todayAppts.map(a=>a.id) } }).toArray()
      ])
      const pmap = Object.fromEntries(pts.map(p=>[p.id, { name: p.name, phone: p.phone }]))
      const dmap = Object.fromEntries(docs.map(d=>[d.id,d.full_name]))
      const vmap = Object.fromEntries(visits.map(v=>[v.appointment_id, v.id]))
      const [revAgg, pendAgg] = await Promise.all([
        db.collection('invoices').aggregate([ { $match: { clinic_id: cid, payment_status:'paid', invoice_date: today } }, { $group: { _id:null, sum: { $sum: '$total_amount' } } } ]).toArray(),
        db.collection('invoices').aggregate([ { $match: { clinic_id: cid, payment_status:{ $in:['pending','partial'] }, invoice_date: today } }, { $group: { _id:null, sum: { $sum: '$total_amount' } } } ]).toArray()
      ])
      const followups = await db.collection('patients').find({ clinic_id: cid, is_archived: { $ne: true }, next_followup_date: { $ne: null, $lte: today } }).limit(5).toArray()
      const fcount = await db.collection('patients').countDocuments({ clinic_id: cid, is_archived: { $ne: true }, next_followup_date: { $ne: null, $lte: today } })
      const [activeLabCases, overdueLabCases, awaitingLabAcceptance, inProductionLabCases, readyLabCases] = await Promise.all([
        db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $nin: CLOSED_STATUSES } }),
        db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $nin: CLOSED_STATUSES }, expected_delivery_date: { $ne: null, $lt: today } }),
        db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $in: AWAITING_ACCEPTANCE_STATUSES } }),
        db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $in: IN_PRODUCTION_STATUSES } }),
        db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $in: READY_STATUSES } }),
      ])
      return json({
        clinic_name: clinic?.name,
        patients_seen_today: doneToday, patients_seen_yesterday: doneYest,
        revenue_today: revAgg[0]?.sum || 0, pending_today: pendAgg[0]?.sum || 0,
        followups_due_count: fcount,
        active_lab_cases: activeLabCases, overdue_lab_cases: overdueLabCases,
        awaiting_lab_acceptance: awaitingLabAcceptance, in_production_lab_cases: inProductionLabCases, ready_lab_cases: readyLabCases,
        today_queue: todayAppts.map(a => ({ ...clean(a), patient_name: pmap[a.patient_id]?.name||a.patient_name_temp, patient_phone: pmap[a.patient_id]?.phone||a.patient_phone_temp, doctor_name: dmap[a.doctor_id]||'', visit_id: vmap[a.id]||null })),
        followups: followups.map(p => ({ ...clean(p), last_visit_reason: '' })),
      })
    }

    // ============ NOTIFICATIONS (clinic-facing lab updates) ============
    if (route === '/notifications' && m === 'GET') {
      const items = await db.collection('notifications').find({ clinic_id: cid }).sort({ created_at: -1 }).limit(30).toArray()
      const unread = await db.collection('notifications').countDocuments({ clinic_id: cid, read: { $ne: true } })
      return json({ notifications: items.map(clean), unread_count: unread })
    }
    if (route === '/notifications/read' && m === 'POST') {
      const b = await request.json().catch(() => ({}))
      const filter = { clinic_id: cid, read: { $ne: true } }
      if (Array.isArray(b?.ids) && b.ids.length) filter.id = { $in: b.ids }
      await db.collection('notifications').updateMany(filter, { $set: { read: true, read_at: new Date() } })
      const unread = await db.collection('notifications').countDocuments({ clinic_id: cid, read: { $ne: true } })
      return json({ ok: true, unread_count: unread })
    }

    // ============ AI PATIENT SUMMARY ============
    if (route === '/generate-summary' && m === 'POST') {
      if (isReceptionist(profile)) return err('Forbidden', 403)
      const b = await request.json()
      if (!b.patient_id) return err('patient_id required')
      const p = await db.collection('patients').findOne({ id: b.patient_id, clinic_id: cid })
      if (!p) return err('Patient not found', 404)
      const visits = await db.collection('visits').find({ patient_id: b.patient_id, clinic_id: cid }).sort({ visit_date: -1, created_at: -1 }).limit(8).toArray()
      if (visits.length === 0) return err('No visits to summarize yet', 400)
      const visitText = visits.map(v => `Date: ${v.visit_date}\nComplaint: ${v.chief_complaint||'-'}\nDiagnosis: ${v.diagnosis||'-'}\nTreatment: ${v.treatment_done||'-'}\nPlan: ${v.treatment_plan||'-'}\n---`).join('\n')
      const prompt = `You are a clinical documentation assistant for a dental clinic in India. Based on the visit history below, write a concise clinical summary (maximum 200 words).\n\nCover: main dental complaints, treatments completed, current dental status, and recommended follow-up actions already mentioned by the doctor.\n\nDo not diagnose. Do not suggest treatments not already mentioned in the notes. Use professional clinical language.\n\nPatient: ${p.name}, Age: ${p.age||'unknown'}\nBlood Group: ${p.blood_group||'unknown'}\nKnown Allergies: ${p.allergies||'None recorded'}\n\nVisit History (most recent first):\n${visitText}\n\nWrite the clinical summary now:`
      try {
        const text = await createAnthropicMessage({
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        })
        if (!text) return err('Empty AI response', 500)
        await db.collection('patients').updateOne({ id: b.patient_id, clinic_id: cid }, { $set: { ai_summary: text, ai_summary_generated_at: new Date() } })
        return json({ ok: true, summary: text, generated_at: new Date() })
      } catch (e) {
        console.error('AI summary error:', e?.message || e)
        return err(`AI service error: ${e?.message || 'Unknown'}`, 502)
      }
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
