import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'
import { LAB_CASE_STATUSES, safeIsoDate, populateNames } from '@/lib/lab-case-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const patient_id = url.searchParams.get('patient_id')
    const vendor_id = url.searchParams.get('vendor_id')
    const f = { clinic_id: cid }
    if (status && status !== 'all') f.status = status
    if (patient_id) f.patient_id = patient_id
    if (vendor_id) f.vendor_id = vendor_id
    const list = await db.collection('lab_cases').find(f).sort({ created_at: -1 }).limit(500).toArray()
    const enriched = await populateNames(db, cid, list.map(clean))
    return json({ lab_cases: enriched })
  } catch (e) {
    console.error('Lab cases GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const b = await request.json()
    // Validation
    if (!b.patient_id) return err('Patient is required')
    if (!b.vendor_id) return err('Vendor is required')
    if (!b.case_type || !b.case_type.trim()) return err('Case type is required')
    const patient = await db.collection('patients').findOne({ id: b.patient_id, clinic_id: cid })
    if (!patient) return err('Selected patient not found', 404)
    const vendor = await db.collection('vendors').findOne({ id: b.vendor_id, clinic_id: cid })
    if (!vendor) return err('Selected vendor not found', 404)
    const expected = safeIsoDate(b.expected_delivery_date)

    const id = uuidv4()
    const count = await db.collection('lab_cases').countDocuments({ clinic_id: cid })
    const case_number = 'LC' + String(count + 1).padStart(5, '0')
    const now = new Date()
    await db.collection('lab_cases').insertOne({
      id,
      clinic_id: cid,
      case_number,
      patient_id: b.patient_id,
      vendor_id: b.vendor_id,
      case_type: b.case_type.trim(),
      tooth_numbers: b.tooth_numbers || '',
      shade: b.shade || '',
      material: b.material || '',
      description: b.description || '',
      urgency: b.urgency || 'routine',
      expected_delivery_date: expected,
      status: 'pending',
      timeline: [{ status: 'pending', note: 'Lab case created', by: profile.id, by_name: profile.full_name || '', at: now }],
      created_by: profile.id,
      created_at: now,
      updated_at: now,
    })
    return json({ ok: true, id, case_number })
  } catch (e) {
    console.error('Lab cases POST error:', e)
    return err('Internal server error', 500)
  }
}
