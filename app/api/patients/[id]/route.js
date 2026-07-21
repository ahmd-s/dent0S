import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission, canAccessClinical, filterPatientFields } from '@/lib/rbac'
import { getProfileRoles } from '@/lib/profile-roles'
import { assertDoctorOwnsPatient } from '@/lib/doctor-scope'

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

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    const p = await db.collection('patients').findOne({ id: params.id, clinic_id: cid })
    if (!p) return err('Not found', 404)
    const allowed = await assertDoctorOwnsPatient(db, cid, roles, profile.id, params.id)
    if (!allowed) return err('Forbidden', 403)
    return json({ patient: filterPatientFields(clean(p), roles) })
  } catch (e) {
    console.error('Patient GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    const allowed = await assertDoctorOwnsPatient(db, cid, roles, profile.id, params.id)
    if (!allowed) return err('Forbidden', 403)
    const b = await request.json(); delete b.id; delete b.clinic_id; delete b.created_at; delete b._id
    if (!hasPermission(profile, 'patients', 'update')) return err('Forbidden', 403)
    if (!canAccessClinical(profile)) {
      delete b.allergies
      delete b.medical_history
      delete b.blood_group
    }
    await db.collection('patients').updateOne({ id: params.id, clinic_id: cid }, { $set: b })
    return json({ ok:true })
  } catch (e) {
    console.error('Patient PUT error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    if (!hasPermission(profile, 'patients', 'delete')) return err('Forbidden', 403)
    const allowed = await assertDoctorOwnsPatient(db, cid, roles, profile.id, params.id)
    if (!allowed) return err('Forbidden', 403)
    const p = await db.collection('patients').findOne({ id: params.id, clinic_id: cid })
    if (!p) return err('Not found', 404)
    await db.collection('visits').deleteMany({ patient_id: params.id, clinic_id: cid })
    await db.collection('appointments').deleteMany({ patient_id: params.id, clinic_id: cid })
    await db.collection('prescriptions').deleteMany({ patient_id: params.id, clinic_id: cid })
    await db.collection('patients').deleteOne({ id: params.id, clinic_id: cid })
    return json({ ok:true })
  } catch (e) {
    console.error('Patient DELETE error:', e)
    return err('Internal server error', 500)
  }
}
