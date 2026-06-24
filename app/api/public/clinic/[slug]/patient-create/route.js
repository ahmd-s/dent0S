// Path: app/api/public/clinic/[slug]/patient-create/route.js
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/public/clinic/:slug/patient-create
 *
 * Body: { name, phone, age?, gender? }
 *
 * IDEMPOTENT — if a patient with this phone already exists in the clinic,
 * returns the existing record instead of creating a duplicate.
 *
 * Response:
 *   { patient: { id, name, phone, patient_code, age, gender }, existing: boolean }
 *
 * No authentication required — public booking endpoint.
 * Rate-limit via the proxy / middleware layer if needed.
 */
export async function POST(request, { params }) {
  try {
    const { slug } = params
    const body = await request.json()

    const name = body.name?.trim()
    const phone = body.phone?.toString().trim().replace(/\D/g, '')
    const age = body.age ? parseInt(body.age) : null
    const gender = body.gender?.trim() || ''

    // ── Validation ─────────────────────────────────────────────────────────
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'A valid 10-digit phone number is required' }, { status: 400 })
    }

    const db = await getDb()

    // ── Resolve clinic ──────────────────────────────────────────────────────
    const clinic = await db.collection('clinics').findOne({ slug })
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // ── Idempotency check: return existing patient if phone already used ────
    const existing = await db.collection('patients').findOne(
      { clinic_id: clinic.id, phone },
      { projection: { _id: 0, id: 1, name: 1, phone: 1, patient_code: 1, age: 1, gender: 1 } }
    )
    if (existing) {
      return NextResponse.json({ patient: existing, existing: true })
    }

    // ── Generate unique patient code via atomic counter ────────────────────
    const counter = await db.collection('counters').findOneAndUpdate(
      { clinic_id: clinic.id, type: 'patient' },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after' }
    )
    const seq = counter?.sequence ?? 1
    const patientCode = 'PT' + String(seq).padStart(5, '0')

    // ── Create new patient ─────────────────────────────────────────────────
    const id = uuidv4()
    const newPatient = {
      id,
      clinic_id: clinic.id,
      name,
      phone,
      age,
      gender,
      patient_code: patientCode,
      dob: null,
      blood_group: '',
      allergies: '',
      medical_history: '',
      address: '',
      referral_source: 'online_booking',
      total_visits: 0,
      is_archived: false,
      created_via: 'public_booking',
      created_at: new Date()
    }

    try {
      await db.collection('patients').insertOne(newPatient)
    } catch (insertErr) {
      // Handle race condition: unique index violation means another insert
      // beat us to it — fetch and return that patient instead.
      if (insertErr.code === 11000) {
        const raceExisting = await db.collection('patients').findOne(
          { clinic_id: clinic.id, phone },
          { projection: { _id: 0, id: 1, name: 1, phone: 1, patient_code: 1, age: 1, gender: 1 } }
        )
        if (raceExisting) {
          return NextResponse.json({ patient: raceExisting, existing: true })
        }
      }
      throw insertErr
    }

    const publicPatient = { id, name, phone, patient_code: patientCode, age, gender }
    return NextResponse.json({ patient: publicPatient, existing: false }, { status: 201 })

  } catch (e) {
    console.error('patient-create error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
