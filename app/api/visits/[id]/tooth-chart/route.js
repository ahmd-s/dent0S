import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { v4 as uuidv4 } from 'uuid'

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
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function GET(request, { params }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const { db } = user
  const cid = user.profile.clinic_id
  const visitId = params.id

  const chart = await db.collection('tooth_charts').findOne({
    visit_id: visitId, clinic_id: cid
  })
  return json({ chart: chart ? clean(chart) : null })
}

export async function PUT(request, { params }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const { profile, db } = user
  const cid = profile.clinic_id
  const visitId = params.id

  if (!hasPermission(profile.role, 'visits', 'update')) return err('Forbidden', 403)
  const b = await request.json()

  // Verify visit belongs to this clinic
  const visit = await db.collection('visits').findOne({ id: visitId, clinic_id: cid })
  if (!visit) return err('Not found', 404)

  // Verify patient belongs to this clinic
  if (b.patient_id) {
    const patient = await db.collection('patients').findOne({ id: b.patient_id, clinic_id: cid })
    if (!patient) return err('Not found', 404)
  }

  const existing = await db.collection('tooth_charts').findOne({
    visit_id: visitId, clinic_id: cid
  })
  if (existing) {
    await db.collection('tooth_charts').updateOne(
      { visit_id: visitId, clinic_id: cid },
      { $set: { teeth: b.teeth, last_updated: new Date(), updated_by: profile.id } }
    )
  } else {
    await db.collection('tooth_charts').insertOne({
      id: uuidv4(),
      visit_id: visitId,
      clinic_id: cid,
      patient_id: b.patient_id,
      teeth: b.teeth,
      last_updated: new Date(),
      updated_by: profile.id,
      created_at: new Date()
    })
  }
  return json({ ok: true })
}
