import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { getPlatformBusinessAnalytics } from '@/lib/analytics-engine'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/platform-admin/business — platform-wide BI analytics */
export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

    const analytics = await getPlatformBusinessAnalytics(ctx.db)
    return cors(NextResponse.json({ ok: true, analytics }))
  } catch (e) {
    console.error('Platform business analytics error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
