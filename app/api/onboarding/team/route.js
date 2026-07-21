import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { hashPassword, getCurrentUser } from '@/lib/auth'
import { sendStaffInviteEmail } from '@/lib/invite-email'
import { canManageStaff } from '@/lib/rbac'
import { validateRolesArray } from '@/lib/profile-roles'

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
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, clinic, db } = ctx; const cid = profile.clinic_id
    if (!canManageStaff(profile)) return err('Forbidden', 403)
    const b = await request.json(); const email = (b.email||'').toLowerCase().trim()
    const rolesInput = b.roles || (b.role ? [b.role] : null)
    const validated = validateRolesArray(rolesInput)
    if (!validated.ok) return err(validated.error, 400)
    if (validated.roles.some(r => r === 'admin')) return err('Admin role cannot be assigned during onboarding', 400)
    if (!b.full_name || !email || !b.password) return err('Missing fields')
    if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
    const newId = uuidv4()
    const roles = validated.roles
    await db.collection('profiles').insertOne({ id: newId, clinic_id: cid, email, password_hash: await hashPassword(b.password), full_name: b.full_name, roles, role: roles[0], phone:'', is_active:true, created_at:new Date() })
    const origin = new URL(request.url).origin
    const emailResult = await sendStaffInviteEmail({
      to: email,
      staffName: b.full_name,
      clinicName: clinic?.name,
      temporaryPassword: b.password,
      loginUrl: `${origin}/login`,
    })
    return json({ ok:true, id:newId, invite_email_sent: !!emailResult?.sent })
  } catch (e) {
    console.error('Onboarding team error:', e)
    return err('Internal server error', 500)
  }
}
