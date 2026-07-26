import { NextResponse } from 'next/server'
import { consumeGooglePlatformAdminPendingCookie } from '@/lib/google-oauth-cookies'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function GET() {
  const pending = consumeGooglePlatformAdminPendingCookie()
  if (!pending) return json({ ok: false })
  return json({
    ok: true,
    pending_token: pending.pending_token,
    setup_required: pending.setup_required,
  })
}
