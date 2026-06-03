import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { secureToken } from '@/lib/lab-case-helpers'
import { logAudit, AUDIT_ACTIONS, AUDIT_SOURCE } from '@/lib/audit'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

// Records that the secure link was shared with the lab (e.g. via WhatsApp) and
// returns the case's public token so the client can build the share link.
export async function POST(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const lc = await db.collection('lab_cases').findOne({ id: params.id, clinic_id: cid })
    if (!lc) return err('Lab case not found', 404)
    let token = lc.public_token
    if (!token) {
      token = secureToken()
      await db.collection('lab_cases').updateOne({ id: params.id, clinic_id: cid }, { $set: { public_token: token } })
    }
    const channel = (await request.json().catch(() => ({})))?.channel || 'WhatsApp'
    await logAudit(db, { clinicId: cid, labCaseId: lc.id, caseNumber: lc.case_number, action: AUDIT_ACTIONS.WHATSAPP_SHARED, source: AUDIT_SOURCE.CLINIC, actorId: profile.id, actorName: profile.full_name || '', meta: { channel } })
    return json({ ok: true, public_token: token })
  } catch (e) {
    console.error('Lab case share POST error:', e)
    return err('Internal server error', 500)
  }
}
