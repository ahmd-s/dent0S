import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { verifyPassword, signToken, setAuthCookie, getCurrentUser } from '@/lib/auth'

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

export async function POST(request) {
  try {
    const db = await getDb()
    const b = await request.json()
    if (!b.email || !b.password) return err('Email and password required')
    const profile = await db.collection('profiles').findOne({ email: b.email.toLowerCase().trim() })
    if (!profile || !profile.is_active) return err('Invalid credentials', 401)
    if (!await verifyPassword(b.password, profile.password_hash)) return err('Invalid credentials', 401)
    const c = await db.collection('clinics').findOne({ id: profile.clinic_id })
    await db.collection('profiles').updateOne({ id: profile.id }, { $set: { last_login_at: new Date() } })
    setAuthCookie(signToken({ uid: profile.id, cid: profile.clinic_id, role: profile.role }))
    return json({ ok:true, onboarding_complete: !!c?.onboarding_complete })
  } catch (e) {
    console.error('Auth login error:', e)
    return err('Internal server error', 500)
  }
}
