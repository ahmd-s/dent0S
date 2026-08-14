import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/api-helpers'
import { canManageInventory } from '@/lib/rbac'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function POST(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    const { profile, db } = ctx; const cid = profile.clinic_id

    if (!canManageInventory(profile)) return err('Forbidden', 403)

    const lc = await db.collection('lab_cases').findOne({ id: params.id, clinic_id: cid })
    if (!lc) return err('Lab case not found', 404)

    const token = uuidv4()
    await db.collection('lab_cases').updateOne(
      { id: params.id, clinic_id: cid },
      { $set: { stl_upload_token: token, stl_file_url: null, updated_at: new Date() } }
    )

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    return json({ ok: true, upload_url: `${base}/lab-upload/${token}` })
  } catch (e) {
    console.error('Generate STL link POST error:', e)
    return err('Internal server error', 500)
  }
}
