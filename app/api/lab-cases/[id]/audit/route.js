import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

// Returns the audit trail for a single lab case (clinic staff only).
export async function GET(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const lc = await db.collection('lab_cases').findOne({ id: params.id, clinic_id: cid })
    if (!lc) return err('Lab case not found', 404)
    const logs = await db.collection('audit_logs')
      .find({ lab_case_id: params.id, clinic_id: cid })
      .sort({ at: -1 })
      .limit(200)
      .toArray()
    return json({ audit: logs.map(clean) })
  } catch (e) {
    console.error('Lab case audit GET error:', e)
    return err('Internal server error', 500)
  }
}
