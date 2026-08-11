import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import { findAppointmentConflicts } from '@/lib/appointment-conflicts'
import { enrichAppointments } from '@/lib/appointment-enrichment'
import { addDays } from '@/lib/appointment-time'
import { doctorAppointmentFilter } from '@/lib/doctor-scope'
import { getProfileRoles } from '@/lib/profile-roles'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const { profile, db } = ctx
  const cid = profile.clinic_id
  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const patient_id = url.searchParams.get('patient_id')
  const doctor_id = url.searchParams.get('doctor_id')
  const chair_id = url.searchParams.get('chair_id')

  const roles = getProfileRoles(profile)
  const f = { clinic_id: cid, ...doctorAppointmentFilter(roles, profile.id) }

  if (date) f.appointment_date = date
  else if (dateFrom || dateTo) {
    f.appointment_date = {}
    if (dateFrom) f.appointment_date.$gte = dateFrom
    if (dateTo) f.appointment_date.$lte = dateTo
  }
  if (patient_id) f.patient_id = patient_id
  if (doctor_id) f.doctor_id = doctor_id
  if (chair_id) f.chair_id = chair_id

  const apps = await db.collection('appointments')
    .find(f)
    .sort({ appointment_date: 1, appointment_time: 1 })
    .toArray()

  const enriched = await enrichAppointments(db, cid, apps)
  return json({ appointments: enriched })
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const { profile, db } = ctx
  const cid = profile.clinic_id
  const b = await request.json()
  if (!b.appointment_date || !b.appointment_time) return err('Date and time required')

  if (b.patient_id) {
    const patient = await db.collection('patients').findOne({ id: b.patient_id, clinic_id: cid })
    if (!patient) return err('Not found', 404)
  }
  if (b.doctor_id) {
    const doctor = await db.collection('profiles').findOne({ id: b.doctor_id, clinic_id: cid })
    if (!doctor) return err('Not found', 404)
  }
  if (b.chair_id) {
    const chair = await db.collection('clinic_chairs').findOne({ id: b.chair_id, clinic_id: cid })
    if (!chair) return err('Chair not found', 404)
  }

  const doctorToCheck = b.doctor_id || profile.id
  const { hasConflict, conflicts } = await findAppointmentConflicts(db, {
    clinicId: cid,
    doctorId: doctorToCheck,
    chairId: b.chair_id,
    appointmentDate: b.appointment_date,
    appointmentTime: b.appointment_time,
    durationMinutes: b.duration_minutes || 30,
  })
  if (hasConflict && !b.force) {
    return json({ success: false, message: conflicts[0]?.message || 'This slot is already booked.', conflicts }, 409)
  }

  const id = uuidv4()
  const doc = {
    id,
    clinic_id: cid,
    patient_id: b.patient_id || null,
    doctor_id: b.doctor_id || profile.id,
    chair_id: b.chair_id || null,
    patient_name_temp: b.patient_name_temp || '',
    patient_phone_temp: b.patient_phone_temp || '',
    appointment_date: b.appointment_date,
    appointment_time: b.appointment_time,
    duration_minutes: b.duration_minutes || 30,
    status: b.status || 'scheduled',
    appointment_type: b.appointment_type || 'consultation',
    chief_complaint: b.chief_complaint || '',
    notes: b.notes || '',
    booked_via: b.booked_via || 'in_clinic',
    priority: b.priority || 'normal',
    queue_position: null,
    checked_in_at: null,
    created_by: profile.id,
    created_at: new Date(),
  }

  await db.collection('appointments').insertOne(doc)

  let patientName = b.patient_name_temp
  if (b.patient_id) {
    const pt = await db.collection('patients').findOne({ id: b.patient_id, clinic_id: cid })
    patientName = pt?.name || patientName
  }
  await logActivity(db, profile, ACTIVITY_EVENTS.APPOINTMENT_CREATED, {
    patientId: b.patient_id,
    appointmentId: id,
    metadata: {
      patient_name: patientName,
      appointment_date: b.appointment_date,
      appointment_time: b.appointment_time,
    },
  })

  if (doc.status === 'confirmed') {
    await logActivity(db, profile, ACTIVITY_EVENTS.APPOINTMENT_CONFIRMED, {
      patientId: b.patient_id,
      appointmentId: id,
    })
  }

  return json({ ok: true, id })
}
