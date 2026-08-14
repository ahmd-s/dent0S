import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission, canAccessClinical } from '@/lib/rbac'
import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
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

const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

export async function GET(request, { params }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const { profile, db } = user
  const cid = profile.clinic_id
  const id = params.id

  const p = await db.collection('patients').findOne({ id, clinic_id: cid })
  if (!p) return err('Not found', 404)
  return json({ patient: clean(p) })
}

export async function PUT(request, { params }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const { profile, db } = user
  const cid = profile.clinic_id
  const id = params.id

  const b = await request.json()
  delete b.id
  delete b.clinic_id
  delete b.created_at
  delete b._id

  if (!hasPermission(profile.role, 'patients', 'update')) return err('Forbidden', 403)
  if (!canAccessClinical(profile.role)) {
    delete b.allergies
    delete b.medical_history
  }

  await db.collection('patients').updateOne({ id, clinic_id: cid }, { $set: b })
  await logActivity(db, profile, ACTIVITY_EVENTS.PATIENT_UPDATED, { patientId: id })
  const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
  invalidateClinicDashboard(cid, b.next_followup_date !== undefined ? 'followup' : 'patient')
  return json({ ok: true })
}

export async function DELETE(request, { params }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const { profile, db } = user
  const cid = profile.clinic_id
  const id = params.id

  if (!hasPermission(profile.role, 'patients', 'delete')) return err('Forbidden', 403)
  const p = await db.collection('patients').findOne({ id, clinic_id: cid })
  if (!p) return err('Not found', 404)

  // Delete related records
  await db.collection('visits').deleteMany({ patient_id: id, clinic_id: cid })
  await db.collection('appointments').deleteMany({ patient_id: id, clinic_id: cid })
  await db.collection('prescriptions').deleteMany({ patient_id: id, clinic_id: cid })
  await db.collection('patients').deleteOne({ id, clinic_id: cid })
  await logActivity(db, profile, ACTIVITY_EVENTS.PATIENT_DELETED, {
    patientId: id,
    metadata: { patient_name: p.name },
  })

  const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
  invalidateClinicDashboard(cid, 'patient')
  return json({ ok: true })
}
