import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

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

export async function GET() {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!hasPermission(profile.role, 'consent_templates', 'read')) return err('Forbidden', 403)
    const list = await db.collection('treatment_templates').find({ clinic_id: cid }).sort({ name: 1 }).toArray()
    return json({ templates: list.map(clean) })
  } catch (e) {
    console.error('Treatment templates GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!hasPermission(profile.role, 'consent_templates', 'create')) return err('Forbidden', 403)
    const b = await request.json()
    if (!b.name) return err('Name required')
    const id = uuidv4()
    await db.collection('treatment_templates').insertOne({ id, clinic_id: cid, name: b.name, default_notes: b.default_notes||'', default_price: parseFloat(b.default_price)||0, category: b.category||'', created_at: new Date() })
    return json({ ok:true, id })
  } catch (e) {
    console.error('Treatment templates POST error:', e)
    return err('Internal server error', 500)
  }
}
