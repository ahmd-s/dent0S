import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { timeToMinutes } from '@/lib/block-times'

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
