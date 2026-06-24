import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { cors } from '@/lib/api-helpers'
import { LAB_PORTAL_STATUSES, sanitizeForPortal, statusLabel } from '@/lib/lab-case-helpers'
import { logAudit, AUDIT_ACTIONS, AUDIT_SOURCE } from '@/lib/audit'
import { createLabStatusNotification } from '@/lib/notifications'

const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

// PUBLIC (no auth). Lets the lab advance the case status from the portal.
// Only the lab-facing statuses are accepted; the case is resolved strictly by
// its secure token and updates are attributed to the Lab Portal source.
export async function POST(request, { params }) {
  try {
    const id = params.id
    if (!id || id.length < 16) return err('Invalid link', 404)
    const body = await request.json().catch(() => ({}))
    const status = body?.status
    if (!LAB_PORTAL_STATUSES.includes(status)) return err('Invalid status')

    const db = await getDb()
    const lc = await db.collection('lab_cases').findOne({ public_token: id })
    if (!lc) return err('Lab case not found', 404)

    const vendor = await db.collection('vendors').findOne({ id: lc.vendor_id, clinic_id: lc.clinic_id })
    const labName = vendor?.name || 'Lab'
    const now = new Date()
    const note = (body?.note || '').toString().slice(0, 500)
    const changed = status !== lc.status

    if (changed) {
      await db.collection('lab_cases').updateOne(
        { public_token: id },
        {
          $set: { status, updated_at: now },
          $push: { timeline: { status, note, by_name: labName, source: AUDIT_SOURCE.LAB_PORTAL, at: now } },
        }
      )
      await logAudit(db, { clinicId: lc.clinic_id, labCaseId: lc.id, caseNumber: lc.case_number, action: AUDIT_ACTIONS.LAB_UPDATED_STATUS, source: AUDIT_SOURCE.LAB_PORTAL, actorName: labName, meta: { status, label: statusLabel(status), note } })
    }

    const fresh = await db.collection('lab_cases').findOne({ public_token: id })
    const patient = await db.collection('patients').findOne({ id: fresh.patient_id, clinic_id: fresh.clinic_id })

    if (changed) {
      await createLabStatusNotification(db, {
        clinicId: lc.clinic_id,
        labCase: { id: fresh.id, case_number: fresh.case_number, patient_name: patient?.name || 'Patient' },
        status,
        labName,
        note,
      })
    }
    const view = sanitizeForPortal({ ...fresh, patient_name: patient?.name || 'Patient' }, { labName })
    return json({ ok: true, lab_case: view })
  } catch (e) {
    console.error('Lab portal status POST error:', e)
    return err('Internal server error', 500)
  }
}
