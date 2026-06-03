import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { cors } from '@/lib/api-helpers'
import { sanitizeForPortal } from '@/lib/lab-case-helpers'
import { logAudit, AUDIT_ACTIONS, AUDIT_SOURCE } from '@/lib/audit'

const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

// PUBLIC (no auth). Resolves a lab case strictly by its unguessable token and
// returns only the sanitized, single-case view. Never exposes clinic data,
// other patients/vendors, internal ids or staff identities.
export async function GET(request, { params }) {
  try {
    const token = params.token
    if (!token || token.length < 16) return err('Invalid link', 404)
    const db = await getDb()
    const lc = await db.collection('lab_cases').findOne({ public_token: token })
    if (!lc) return err('Lab case not found', 404)

    const [patient, vendor] = await Promise.all([
      db.collection('patients').findOne({ id: lc.patient_id, clinic_id: lc.clinic_id }),
      db.collection('vendors').findOne({ id: lc.vendor_id, clinic_id: lc.clinic_id }),
    ])
    const view = sanitizeForPortal({ ...lc, patient_name: patient?.name || 'Patient' }, { labName: vendor?.name || '' })

    // Log "Lab Opened Link" at most once per 5-minute window to avoid noise.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recent = await db.collection('audit_logs').findOne({ lab_case_id: lc.id, action: AUDIT_ACTIONS.LAB_OPENED_LINK, at: { $gte: fiveMinAgo } })
    if (!recent) {
      await logAudit(db, { clinicId: lc.clinic_id, labCaseId: lc.id, caseNumber: lc.case_number, action: AUDIT_ACTIONS.LAB_OPENED_LINK, source: AUDIT_SOURCE.LAB_PORTAL, actorName: vendor?.name || 'Lab' })
    }
    return json({ lab_case: view })
  } catch (e) {
    console.error('Lab portal GET error:', e)
    return err('Internal server error', 500)
  }
}
