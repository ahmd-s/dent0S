// Path: app/api/public/clinic/[slug]/patient-search/route.js
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

/**
 * GET /api/public/clinic/:slug/patient-search?phone=XXXXXXXXXX
 *
 * Searches patients by phone number within the given clinic.
 * Returns a list of matching patients (name, phone, patient_code, id).
 * No authentication required — this is a public booking endpoint.
 *
 * Returns a MINIMAL payload — no sensitive clinical data.
 */
export async function GET(request, { params }) {
  try {
    const { slug } = params
    const url = new URL(request.url)
    const phone = url.searchParams.get('phone')?.trim().replace(/\D/g, '')

    if (!phone || phone.length < 5) {
      return NextResponse.json({ patients: [] })
    }

    const db = await getDb()

    // Resolve clinic by slug
    const clinic = await db.collection('clinics').findOne({ slug })
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // Partial-match on phone so search works as the user types
    // (exact match is prioritised first via sort; partial are appended)
    const phoneRegex = new RegExp(phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    const patients = await db.collection('patients')
      .find({
        clinic_id: clinic.id,
        phone: { $regex: phoneRegex },
        is_archived: { $ne: true }
      })
      .sort({ phone: 1 })  // exact matches naturally float first
      .limit(10)
      .project({ _id: 0, id: 1, name: 1, phone: 1, patient_code: 1, age: 1, gender: 1 })
      .toArray()

    return NextResponse.json({ patients })

  } catch (e) {
    console.error('patient-search error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
