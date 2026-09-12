import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { runBulkClinicAction } from '@/lib/platform-admin-console'

export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const body = await request.json().catch(() => ({}))
    const result = await runBulkClinicAction(ctx.db, ctx.profile, {
      action: body.action,
      clinicIds: body.clinic_ids,
      reason: body.reason,
      days: body.days,
      confirmation: body.confirmation,
    })
    if (!result.ok && result.error) return json({ error: result.error }, 400)
    return json(result)
  } catch (e) {
    console.error('Platform admin bulk clinics error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
