import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { runDiagnostics } from '@/lib/diagnostics-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const result = await runDiagnostics(db, { scope: 'platform' })
    return json(result)
  } catch (e) {
    console.error('Platform diagnostics error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
