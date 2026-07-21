import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'
import { LAB_CASE_STATUSES, safeIsoDate, populateNames, secureToken } from '@/lib/lab-case-helpers'
import { logAudit, AUDIT_ACTIONS, AUDIT_SOURCE } from '@/lib/audit'
import { canManageInventory } from '@/lib/rbac'

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
    if (status && status !== 'all') {
      const parts = status.split(',').map(s => s.trim()).filter(Boolean)
      f.status = parts.length > 1 ? { $in: parts } : parts[0]
    }
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
    
    if (!canManageInventory(profile)) return err('Forbidden', 403)
    
    const b = await request.json()
    // Validation
    if (!b.patient_id) return err('Patient is required')
    if (!b.vendor_id) return err('Vendor is required')
    if (!b.case_type || !b.case_type.trim()) return err('Case type is required')
    const patient = await db.collection('patients').findOne({ id: b.patient_id, clinic_id: cid })
    if (!patient) return err('Selected patient not found', 404)
    const vendor = await db.collection('vendors').findOne({ id: b.vendor_id, clinic_id: cid })
    if (!vendor) return err('Selected vendor not found', 404)
    const clinic = await db.collection('clinics').findOne({ id: cid })
    const expected = safeIsoDate(b.expected_delivery_date)

    const id = uuidv4()
    const count = await db.collection('lab_cases').countDocuments({ clinic_id: cid })
    const case_number = 'LC' + String(count + 1).padStart(5, '0')
    const now = new Date()
    const public_token = secureToken()
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
      public_token,
      attachments: [],
      timeline: [{ status: 'pending', note: 'Lab case created', by: profile.id, by_name: profile.full_name || '', source: AUDIT_SOURCE.CLINIC, at: now }],
      created_by: profile.id,
      created_at: now,
      updated_at: now,
    })

    // Notify lab via WhatsApp (fire and forget)
    if (vendor?.phone) {
      const { sendWhatsApp } = await import('@/lib/whatsapp')
      const msg = `🦷 New Lab Case from ${clinic?.name || 'Dental Clinic'}\n\n` +
        `Case: ${case_number}\n` +
        `Type: ${b.case_type}\n` +
        `Tooth: ${b.tooth_numbers || 'N/A'}\n` +
        `Expected: ${expected || 'TBD'}\n\n` +
        `Reply with:\n` +
        `RECEIVED ${case_number} — when you receive it\n` +
        `READY ${case_number} — when it's ready`
      sendWhatsApp(vendor.phone, msg)
    }

    await logAudit(db, { clinicId: cid, labCaseId: id, caseNumber: case_number, action: AUDIT_ACTIONS.CASE_CREATED, source: AUDIT_SOURCE.CLINIC, actorId: profile.id, actorName: profile.full_name || '' })
    await logAudit(db, { clinicId: cid, labCaseId: id, caseNumber: case_number, action: AUDIT_ACTIONS.LINK_GENERATED, source: AUDIT_SOURCE.SYSTEM, actorId: profile.id, actorName: profile.full_name || '' })
    return json({ ok: true, id, case_number, public_token })
  } catch (e) {
    console.error('Lab cases POST error:', e)
    return err('Internal server error', 500)
  }
}
