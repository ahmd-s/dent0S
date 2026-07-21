// Path: app/api/public/clinic/[slug]/patient-create/route.js
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { v4 as uuidv4 } from 'uuid'
import { nextPatientCode } from '@/lib/patient-code'

/**
 * POST /api/public/clinic/:slug/patient-create
 *
 * Body: { name, phone, age?, gender? }
 *
 * Rules:
 * - Same clinic + same phone + same name → return existing patient (duplicate)
 * - Same clinic + same phone + different name → create new patient (family member)
 * - Same clinic + different phone + same name → create new patient (common name)
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

    // ── Duplicate check: same clinic + same phone + same name (case-insensitive)
    const nameRegex = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    const existing = await db.collection('patients').findOne({
      clinic_id: clinic.id,
      phone,
      name: { $regex: nameRegex },
      is_archived: { $ne: true }
    })

    if (existing) {
      // Same person — return existing record, don't create duplicate
      return NextResponse.json({
        patient: {
          id: existing.id,
          name: existing.name,
          phone: existing.phone,
          patient_code: existing.patient_code,
          age: existing.age,
          gender: existing.gender
        },
        existing: true,
        message: 'This patient already exists.'
      })
    }

    // ── Generate patient code via atomic counter ────────────────────────────
    const patientCode = await nextPatientCode(db, clinic.id)

    // ── Create new patient ─────────────────────────────────────────────────
    const id = uuidv4()

    try {
      await db.collection('patients').insertOne({
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
      })
    } catch (insertErr) {
      // Unique index violation — race condition, same person submitted twice
      if (insertErr.code === 11000) {
        const raceExisting = await db.collection('patients').findOne({
          clinic_id: clinic.id,
          phone,
          name: { $regex: nameRegex }
        })
        if (raceExisting) {
          return NextResponse.json({
            patient: {
              id: raceExisting.id,
              name: raceExisting.name,
              phone: raceExisting.phone,
              patient_code: raceExisting.patient_code,
              age: raceExisting.age,
              gender: raceExisting.gender
            },
            existing: true
          })
        }
      }
      throw insertErr
    }

    return NextResponse.json({
      patient: { id, name, phone, patient_code: patientCode, age, gender },
      existing: false
    }, { status: 201 })

  } catch (e) {
    console.error('patient-create error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}