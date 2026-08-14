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

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!hasPermission(profile, 'consent_templates', 'update')) return err('Forbidden', 403)
    const b = await request.json(); const u = {}
    for (const k of ['name','default_notes','default_price','category']) if (k in b) u[k] = k==='default_price'?parseFloat(b[k])||0:b[k]
    await db.collection('treatment_templates').updateOne({ id: params.id, clinic_id: cid }, { $set: u })
    return json({ ok:true })
  } catch (e) {
    console.error('Treatment templates PUT error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!hasPermission(profile, 'consent_templates', 'delete')) return err('Forbidden', 403)
    await db.collection('treatment_templates').deleteOne({ id: params.id, clinic_id: cid })
    return json({ ok:true })
  } catch (e) {
    console.error('Treatment templates DELETE error:', e)
    return err('Internal server error', 500)
  }
}
