import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { clearAuthCookie, getCurrentUser, authCookieOptions, AUTH_COOKIE_NAME } from '@/lib/auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function POST() {
  try {
    clearAuthCookie()
    const res = json({ ok: true })
    res.cookies.set(AUTH_COOKIE_NAME, '', { ...authCookieOptions(0), maxAge: 0 })
    // #region agent log
    fetch('http://127.0.0.1:7366/ingest/f3641e0b-1a49-4955-8e0b-16987fcc4471', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '87f42d' },
      body: JSON.stringify({
        sessionId: '87f42d',
        location: 'app/api/auth/logout/route.js:POST',
        message: 'logout clearAuthCookie',
        data: {
          cookieDomain: process.env.NODE_ENV === 'production' ? '.dent-os.in' : '(host-only)',
        },
        timestamp: Date.now(),
        hypothesisId: 'H1',
      }),
    }).catch(() => {})
    // #endregion
    return res
  } catch (e) {
    console.error('Auth logout error:', e)
    return err('Internal server error', 500)
  }
}
