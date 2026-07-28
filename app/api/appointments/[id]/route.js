import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
<<<<<<< HEAD
=======
import { getProfileRoles } from '@/lib/profile-roles'
import { shouldScopeToDoctor } from '@/lib/doctor-scope'
>>>>>>> 1b2c9765788c77fa7ef45790a326d40d9aa5c607

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
<<<<<<< HEAD

const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }
=======
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
>>>>>>> 1b2c9765788c77fa7ef45790a326d40d9aa5c607

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function PUT(request, { params }) {
<<<<<<< HEAD
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const { profile, db } = user
  const cid = profile.clinic_id
  const id = params.id
  const b = await request.json()
  const allowed = ['status', 'appointment_date', 'appointment_time', 'chief_complaint', 'notes', 'appointment_type', 'doctor_id', 'duration_minutes']
  const update = {}
  for (const k of allowed) if (k in b) update[k] = b[k]
  await db.collection('appointments').updateOne({ id, clinic_id: cid }, { $set: update })
  return json({ ok: true })
=======
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    const existing = await db.collection('appointments').findOne({ id: params.id, clinic_id: cid })
    if (!existing) return err('Not found', 404)
    if (shouldScopeToDoctor(roles) && existing.doctor_id !== profile.id) return err('Forbidden', 403)
    const b = await request.json()
    const allowed = ['status','appointment_date','appointment_time','chief_complaint','notes','appointment_type','doctor_id','duration_minutes']
    const update = {}
    for (const k of allowed) if (k in b) update[k] = b[k]
    if (shouldScopeToDoctor(roles) && update.doctor_id && update.doctor_id !== profile.id) {
      return err('Forbidden', 403)
    }
    await db.collection('appointments').updateOne({ id: params.id, clinic_id: cid }, { $set: update })
    return json({ ok:true })
  } catch (e) {
    console.error('Appointment PUT error:', e)
    return err('Internal server error', 500)
  }
>>>>>>> 1b2c9765788c77fa7ef45790a326d40d9aa5c607
}
