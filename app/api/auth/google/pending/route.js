import { NextResponse } from 'next/server'
import { readGoogleSignupPendingCookie } from '@/lib/google-oauth-cookies'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 401) => json({ error: msg }, s)

export async function GET() {
  const pending = readGoogleSignupPendingCookie()
  if (!pending) return err('No pending Google sign-up')
  return json({
    email: pending.email,
    full_name: pending.full_name,
  })
}
