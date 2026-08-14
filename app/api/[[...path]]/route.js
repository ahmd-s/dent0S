import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { timeToMinutes } from '@/lib/block-times'
import { stripInvoiceAuditFields } from '@/lib/invoice-audit'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

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

// time helpers for slot generation
const toMin = t => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim()); if (!m) return null; let h = parseInt(m[1]); const mm = parseInt(m[2]); const ap = m[3].toUpperCase(); if (ap==='PM' && h!==12) h+=12; if (ap==='AM' && h===12) h=0; return h*60+mm }
const fromMin = n => { let h = Math.floor(n/60), mm = n%60; const ap = h>=12?'PM':'AM'; let hh = h%12; if (hh===0) hh=12; return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${ap}` }
const dayNameFromIso = iso => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(iso+'T00:00:00').getDay()]

// Shared conflict detection helper
// Checks if an appointment slot is already booked for a specific doctor
// Blocking statuses: scheduled, arrived, in_progress
// Non-blocking statuses: completed, cancelled, no_show
async function checkAppointmentConflict(db, clinic_id, doctor_id, appointment_date, appointment_time) {
  const conflict = await db.collection('appointments').findOne({
    clinic_id,
    doctor_id: doctor_id || null,
    appointment_date,
    appointment_time,
    status: { $in: ['scheduled', 'arrived', 'in_progress'] }
  })
  return conflict !== null
}

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

async function handle(request, { params }) {
  const path = params?.path || []
  const route = '/' + path.join('/')
  const m = request.method

  try {
    const db = await getDb()

    // ============ PUBLIC ROUTES (no auth) ============
    // Kept here to avoid dynamic routing conflicts with the patient folder.
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
      const f = { clinic_id: c.id, appointment_date: date, status: { $nin: ['cancelled','no_show','completed'] } }
      if (doctor_id) f.doctor_id = doctor_id
      const taken = (await db.collection('appointments').find(f).toArray()).map(a => a.appointment_time)
      
      // Fetch block times for this date and doctor
      const blockTimes = await db.collection('block_times').find({
        clinic_id: c.id,
        date: date,
        is_active: { $ne: false },
        $or: [
          { doctor_id: doctor_id },
          { doctor_id: null },
          { doctor_id: { $exists: false } }
        ]
      }).toArray()

      // Check which slots fall within blocked periods
      // Both slot times and block times are in IST as plain strings
      const blockedTimes = slots.filter(slotTime => {
        const slotMin = timeToMinutes(slotTime)
        return blockTimes.some(block => {
          const blockStart = timeToMinutes(block.start_time)
          const blockEnd = timeToMinutes(block.end_time)
          return slotMin >= blockStart && slotMin < blockEnd
        })
      })

      return json({ 
        date, 
        slots: slots.map(t => ({ 
          time: t, 
          taken: taken.includes(t) || blockedTimes.includes(t),
          blocked: blockedTimes.includes(t)
        })) 
      })
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
      // re-check slot using shared conflict detection
      const hasConflict = await checkAppointmentConflict(db, c.id, b.doctor_id, b.appointment_date, b.appointment_time)
      if (hasConflict) return json({ success: false, message: 'This slot is already booked.' }, 409)

      // check block_times conflict
      const bookingMin = timeToMinutes(b.appointment_time)
      const blockConflict = await db.collection('block_times').findOne({
        clinic_id: c.id,
        date: b.appointment_date,
        is_active: { $ne: false },
        $or: [
          { doctor_id: b.doctor_id },
          { doctor_id: null },
          { doctor_id: { $exists: false } }
        ]
      })

      if (blockConflict) {
        const blockStart = timeToMinutes(blockConflict.start_time)
        const blockEnd = timeToMinutes(blockConflict.end_time)
        if (bookingMin >= blockStart && bookingMin < blockEnd) {
          return err('This time slot is not available', 400)
        }
      }

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
      if (!hasPermission(profile.role, 'settings', 'update')) return err('Forbidden', 403)
      const b = await request.json()
      await db.collection('clinics').updateOne({ id: cid }, { $set: { name: b.name, address: b.address, city: b.city, phone: b.phone, gstin: b.gstin || '', logo_url: b.logo_url || '' }})
      return json({ ok:true })
    }
    if (route === '/onboarding/hours' && m === 'POST') {
      if (!hasPermission(profile.role, 'settings', 'update')) return err('Forbidden', 403)
      const b = await request.json()
      await db.collection('clinics').updateOne({ id: cid }, { $set: { working_hours: b.working_hours }})
      return json({ ok:true })
    }
    if (route === '/onboarding/team' && m === 'POST') {
      if (!canManageStaff(profile.role)) return err('Forbidden', 403)
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
      if (!hasPermission(profile.role, 'settings', 'update')) return err('Forbidden', 403)
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
      if (!hasPermission(profile.role, 'staff', 'read')) return err('Forbidden', 403)
      const team = await db.collection('profiles').find({ clinic_id: cid }).toArray()
      return json({ team: team.map(clean) })
    }
    if (route === '/team' && m === 'POST') {
      if (!canManageStaff(profile.role)) return err('Forbidden', 403)
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
      if (!canManageStaff(profile.role)) return err('Forbidden', 403)
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
      if (!hasPermission(profile.role, 'consent_templates', 'read')) return err('Forbidden', 403)
      const list = await db.collection('treatment_templates').find({ clinic_id: cid }).sort({ name: 1 }).toArray()
      return json({ templates: list.map(clean) })
    }
    if (route === '/treatment_templates' && m === 'POST') {
      if (!hasPermission(profile.role, 'consent_templates', 'create')) return err('Forbidden', 403)
      const b = await request.json()
      if (!b.name) return err('Name required')
      const id = uuidv4()
      await db.collection('treatment_templates').insertOne({ id, clinic_id: cid, name: b.name, default_notes: b.default_notes||'', default_price: parseFloat(b.default_price)||0, category: b.category||'', created_at: new Date() })
      return json({ ok:true, id })
    }
    if (path[0]==='treatment_templates' && path[1] && m==='PUT') {
      if (!hasPermission(profile.role, 'consent_templates', 'update')) return err('Forbidden', 403)
      const b = await request.json(); const u = {}
      for (const k of ['name','default_notes','default_price','category']) if (k in b) u[k] = k==='default_price'?parseFloat(b[k])||0:b[k]
      await db.collection('treatment_templates').updateOne({ id: path[1], clinic_id: cid }, { $set: u })
      return json({ ok:true })
    }
    if (path[0]==='treatment_templates' && path[1] && m==='DELETE') {
      if (!hasPermission(profile.role, 'consent_templates', 'delete')) return err('Forbidden', 403)
      await db.collection('treatment_templates').deleteOne({ id: path[1], clinic_id: cid })
      return json({ ok:true })
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
      const safeInv = stripInvoiceAuditFields(cleanInv)
      return json({ invoice: { ...safeInv, patient: clean(p), items: items.map(clean), visit: visit ? clean(visit) : null, doctor_name: doctor?.full_name || '', clinic: clean(clinic) } })
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
      let arr = list.map(i => stripInvoiceAuditFields({ ...clean(i), patient_name: pmap[i.patient_id] || '—' }))
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
      if (!canManageBilling(profile.role)) return err('Forbidden', 403)
      const inv = await db.collection('invoices').findOne({ id: path[1], clinic_id: cid })
      if (!inv) return err('Not found', 404)
      await db.collection('invoice_items').deleteMany({ invoice_id: inv.id, clinic_id: cid })
      await db.collection('invoices').deleteOne({ id: inv.id, clinic_id: cid })
      return json({ ok:true })
    }

    // ============ PATIENT OUTSTANDING BALANCE ============
    if (path[0] === 'patients' && path[1] === 'outstanding-balance' && m === 'GET') {
      const url = new URL(request.url)
      const patient_id = url.searchParams.get('patient_id')
      if (!patient_id) return err('patient_id required')
      
      const invoices = await db.collection('invoices').find({
        clinic_id: cid,
        patient_id: patient_id,
        payment_status: { $in: ['pending', 'partial'] }
      }).sort({ invoice_date: -1 }).toArray()
      
      const unpaidInvoices = invoices.map(inv => {
        const pending_amount = (inv.total_amount || 0)
        return {
          _id: inv.id,
          invoice_number: inv.invoice_number,
          date: inv.invoice_date,
          total_amount: inv.total_amount,
          pending_amount: pending_amount,
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
      const { buildDashboardStats } = await import('@/lib/dashboard-stats')
      const dashUrl = new URL(request.url)
      const mode = dashUrl.searchParams.get('mode') === 'core' ? 'core' : 'full'
      const allowDebug = process.env.NODE_ENV !== 'production' || process.env.DASHBOARD_PERF_DEBUG === '1'
      const skipCache = allowDebug && dashUrl.searchParams.get('nocache') === '1'
      const timings = allowDebug && dashUrl.searchParams.get('timings') === '1'
      const stats = await buildDashboardStats(db, profile, clinic, { mode, skipCache, timings })
      return json(stats)
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
      if (!canAccessClinical(profile.role)) return err('Forbidden', 403)
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
