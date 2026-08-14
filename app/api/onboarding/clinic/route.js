import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!hasPermission(profile, 'settings', 'update')) return err('Forbidden', 403)
    const b = await request.json()
    await db.collection('clinics').updateOne({ id: cid }, { $set: { name: b.name, address: b.address, city: b.city, phone: b.phone, gstin: b.gstin || '', logo_url: b.logo_url || '' }})
    return json({ ok:true })
  } catch (e) {
    console.error('Onboarding clinic error:', e)
    return err('Internal server error', 500)
  }
}
