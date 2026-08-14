import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
const clean = o => {
  if (!o) return o
  const { _id, ...rest } = o
  return rest
}

export async function GET(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const limit = Math.min(Number(new URL(request.url).searchParams.get('limit') || 100), 200)
    const logs = await db.collection('platform_admin_audit_logs')
      .find({})
      .sort({ at: -1 })
      .limit(limit)
      .toArray()

    return json({ logs: logs.map(clean) })
  } catch (e) {
    console.error('Platform admin audit log error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
