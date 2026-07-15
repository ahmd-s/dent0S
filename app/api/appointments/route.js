import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

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

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

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

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
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
  } catch (e) {
    console.error('Appointments GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const b = await request.json()
    if (!b.appointment_date || !b.appointment_time) return err('Date and time required')
    // conflict check using shared helper
    const doctorToCheck = b.doctor_id || profile.id
    const hasConflict = await checkAppointmentConflict(db, cid, doctorToCheck, b.appointment_date, b.appointment_time)
    if (hasConflict) return json({ success: false, message: 'This slot is already booked.' }, 409)
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
  } catch (e) {
    console.error('Appointments POST error:', e)
    return err('Internal server error', 500)
  }
}
