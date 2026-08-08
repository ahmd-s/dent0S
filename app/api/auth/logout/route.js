import { NextResponse } from 'next/server'
import { clearAuthCookie, authCookieOptions, AUTH_COOKIE_NAME } from '@/lib/auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)

export async function POST() {
  try {
    clearAuthCookie()
    const res = json({ ok: true })
    res.cookies.set(AUTH_COOKIE_NAME, '', { ...authCookieOptions(0), maxAge: 0 })
    return res
  } catch (e) {
    console.error('Auth logout error:', e)
    return err('Internal server error', 500)
  }
}
