// Path: app/api/public/clinic/[slug]/book/route.js
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/public/clinic/:slug/book
 *
 * Books an appointment for an EXISTING patient.
 * Patient MUST already exist — this endpoint NEVER creates patients.
 *
 * Body:
 *   {
 *     patient_id:        string  (required — existing patient's id)
 *     doctor_id:         string  (required)
 *     appointment_date:  string  "YYYY-MM-DD"
 *     appointment_time:  string  "HH:MM AM/PM"
 *     reason:            string  (optional)
 *   }
 *
 * Response:
 *   { ok: true, appointment_id, doctor_name, clinic_name, clinic_phone, clinic_city }
 */
export async function POST(request, { params }) {
  try {
    const { slug } = params
    const body = await request.json()

    const { patient_id, doctor_id, appointment_date, appointment_time, reason } = body

    // ── Input validation ───────────────────────────────────────────────────
    if (!patient_id) {
      return NextResponse.json(
        { error: 'patient_id is required. Create or find a patient first.' },
        { status: 400 }
      )
    }
    if (!doctor_id) {
      return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 })
    }
    if (!appointment_date || !/^\d{4}-\d{2}-\d{2}$/.test(appointment_date)) {
      return NextResponse.json({ error: 'appointment_date is required (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!appointment_time) {
      return NextResponse.json({ error: 'appointment_time is required' }, { status: 400 })
    }

    const db = await getDb()

    // ── Resolve clinic ──────────────────────────────────────────────────────
    const clinic = await db.collection('clinics').findOne({ slug })
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // ── Verify patient belongs to this clinic ──────────────────────────────
    const patient = await db.collection('patients').findOne({
      id: patient_id,
      clinic_id: clinic.id,
      is_archived: { $ne: true }
    })
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found. Please search again or create a new patient.' },
        { status: 404 }
      )
    }

    // ── Verify doctor belongs to this clinic ───────────────────────────────
    const doctor = await db.collection('profiles').findOne({
      id: doctor_id,
      clinic_id: clinic.id,
      role: 'doctor'
    })
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    // ── Check slot availability ────────────────────────────────────────────
    const slotTaken = await db.collection('appointments').findOne({
      clinic_id: clinic.id,
      doctor_id,
      appointment_date,
      appointment_time,
      status: { $nin: ['cancelled'] }
    })
    if (slotTaken) {
      return NextResponse.json(
        { error: 'This time slot was just booked. Please select another time.' },
        { status: 409 }
      )
    }

    // ── Create appointment ─────────────────────────────────────────────────
    const appointmentId = uuidv4()
    await db.collection('appointments').insertOne({
      id: appointmentId,
      clinic_id: clinic.id,
      doctor_id,
      patient_id: patient.id,           // always use resolved patient_id
      patient_name_cache: patient.name,  // denormalised for display — source of truth is patients collection
      appointment_date,
      appointment_time,
      chief_complaint: reason?.trim() || '',
      status: 'scheduled',
      booked_via: 'public_booking',
      created_at: new Date()
    })

    return NextResponse.json({
      ok: true,
      appointment_id: appointmentId,
      doctor_name: doctor.full_name,
      clinic_name: clinic.name,
      clinic_phone: clinic.phone || null,
      clinic_city: clinic.city || null
    })

  } catch (e) {
    console.error('book appointment error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
