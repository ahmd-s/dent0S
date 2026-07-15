import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { hashPassword, getCurrentUser } from '@/lib/auth'
import { sendStaffInviteEmail } from '@/lib/invite-email'
import { hasPermission, canManageStaff } from '@/lib/rbac'

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
    if (!hasPermission(profile.role, 'staff', 'read')) return err('Forbidden', 403)
    const team = await db.collection('profiles').find({ clinic_id: cid }).toArray()
    return json({ team: team.map(clean) })
  } catch (e) {
    console.error('Team GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, clinic, db } = ctx; const cid = profile.clinic_id
    if (!canManageStaff(profile.role)) return err('Forbidden', 403)
    const b = await request.json(); const email = (b.email||'').toLowerCase().trim()
    if (!b.full_name || !email || !b.password || !b.role) return err('Missing fields')
    if (!['doctor', 'receptionist'].includes(b.role)) return err('Role must be doctor or receptionist', 400)
    if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
    const id = uuidv4()
    await db.collection('profiles').insertOne({ id, clinic_id: cid, email, password_hash: await hashPassword(b.password), full_name: b.full_name, role: b.role, phone:'', whatsapp_number: b.whatsapp_number || '', is_active:true, created_at:new Date() })
    const origin = new URL(request.url).origin
    const emailResult = await sendStaffInviteEmail({
      to: email,
      staffName: b.full_name,
      clinicName: clinic?.name,
      temporaryPassword: b.password,
      loginUrl: `${origin}/login`,
    })
    return json({ ok:true, id, invite_email_sent: !!emailResult?.sent })
  } catch (e) {
    console.error('Team POST error:', e)
    return err('Internal server error', 500)
  }
}
