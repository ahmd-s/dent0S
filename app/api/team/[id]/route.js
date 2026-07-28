import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { canManageStaff } from '@/lib/rbac'
import { validateRolesArray, getProfileRoles, hasRole } from '@/lib/profile-roles'

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
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const target = await db.collection('profiles').findOne({ id: params.id, clinic_id: cid })
    if (!target) return err('Team member not found', 404)
    if (target.deleted_at) return err('Cannot update a deleted team member', 400)

    const b = await request.json()
    const update = {}
    const targetRoles = getProfileRoles(target)

    if ('roles' in b || 'role' in b) {
      if (!canManageStaff(profile)) return err('Forbidden', 403)
      const rolesInput = b.roles || (b.role ? [b.role] : null)
      const validated = validateRolesArray(rolesInput)
      if (!validated.ok) return err(validated.error, 400)
      update.roles = validated.roles
      update.role = validated.roles[0]
    }

    if ('consultation_fee' in b) {
      const isSelf = profile.id === params.id
      const canEditFee = canManageStaff(profile) || (isSelf && hasRole(targetRoles, 'doctor'))
      if (!canEditFee) return err('Forbidden', 403)
      const fee = b.consultation_fee === null || b.consultation_fee === ''
        ? null
        : parseFloat(b.consultation_fee)
      update.consultation_fee = Number.isFinite(fee) ? fee : null
    }

    if ('is_active' in b) {
      if (!canManageStaff(profile)) return err('Forbidden', 403)
      update.is_active = b.is_active
    }
    if ('whatsapp_number' in b) {
      if (!canManageStaff(profile)) return err('Forbidden', 403)
      update.whatsapp_number = b.whatsapp_number
    }

    const targetIsAdmin = hasRole(targetRoles, 'admin')

    if ('full_name' in b) {
      if (!canManageStaff(profile)) return err('Forbidden', 403)
      if (targetIsAdmin) return err('Cannot edit admin credentials from team table', 403)
      const name = (b.full_name || '').trim()
      if (!name) return err('Name is required', 400)
      update.full_name = name
    }

    if ('email' in b) {
      if (!canManageStaff(profile)) return err('Forbidden', 403)
      if (targetIsAdmin) return err('Cannot edit admin credentials from team table', 403)
      const email = (b.email || '').toLowerCase().trim()
      if (!email) return err('Email is required', 400)
      if (await db.collection('profiles').findOne({ email, id: { $ne: params.id } })) {
        return err('Email already registered', 400)
      }
      update.email = email
    }

    if ('password' in b && b.password) {
      if (!canManageStaff(profile)) return err('Forbidden', 403)
      if (targetIsAdmin) return err('Cannot edit admin credentials from team table', 403)
      if (b.password.length < 8) return err('Password must be at least 8 characters', 400)
      update.password_hash = await hashPassword(b.password)
    }

    if (Object.keys(update).length === 0) return err('Nothing to update', 400)
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
    if (!canManageStaff(profile)) return err('Forbidden', 403)
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
