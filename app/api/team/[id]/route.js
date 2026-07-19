import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { canManageStaff } from '@/lib/rbac'

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

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!canManageStaff(profile.role)) return err('Forbidden', 403)
    const target = await db.collection('profiles').findOne({ id: params.id, clinic_id: cid })
    if (!target) return err('Team member not found', 404)
    if (target.deleted_at) return err('Cannot update a deleted team member', 400)
    const b = await request.json(); const update = {}
    if ('role' in b) {
      if (!['admin', 'doctor', 'receptionist'].includes(b.role)) return err('Invalid role', 400)
      update.role = b.role
    }
    if ('is_active' in b) update.is_active = b.is_active
    if ('whatsapp_number' in b) update.whatsapp_number = b.whatsapp_number
    await db.collection('profiles').updateOne({ id: params.id, clinic_id: cid }, { $set: update })
    return json({ ok:true })
  } catch (e) {
    console.error('Team PUT error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, clinic, db } = ctx; const cid = profile.clinic_id
    if (!canManageStaff(profile.role)) return err('Forbidden', 403)
    if (params.id === profile.id) return err('Cannot delete your own account', 400)
    if (clinic?.owner_id === params.id) return err('Cannot delete the clinic owner', 400)
    const target = await db.collection('profiles').findOne({ id: params.id, clinic_id: cid })
    if (!target) return err('Team member not found', 404)
    if (target.deleted_at) return err('Team member already deleted', 400)
    await db.collection('profiles').updateOne(
      { id: params.id, clinic_id: cid },
      { $set: { deleted_at: new Date(), is_active: false } }
    )
    return json({ ok: true })
  } catch (e) {
    console.error('Team DELETE error:', e)
    return err('Internal server error', 500)
  }
}
