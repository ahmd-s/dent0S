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

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const chart = await db.collection('tooth_charts').findOne({ 
      visit_id: params.id, clinic_id: cid 
    })
    return json({ chart: chart ? clean(chart) : null })
  } catch (e) {
    console.error('Tooth chart GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!hasPermission(profile, 'visits', 'update')) return err('Forbidden', 403)
    const b = await request.json()
    const existing = await db.collection('tooth_charts').findOne({ 
      visit_id: params.id, clinic_id: cid 
    })
    if (existing) {
      await db.collection('tooth_charts').updateOne(
        { visit_id: params.id, clinic_id: cid },
        { $set: { teeth: b.teeth, last_updated: new Date(), updated_by: profile.id } }
      )
    } else {
      await db.collection('tooth_charts').insertOne({
        id: uuidv4(),
        visit_id: params.id,
        clinic_id: cid,
        patient_id: b.patient_id,
        teeth: b.teeth,
        last_updated: new Date(),
        updated_by: profile.id,
        created_at: new Date()
      })
    }
    return json({ ok: true })
  } catch (e) {
    console.error('Tooth chart PUT error:', e)
    return err('Internal server error', 500)
  }
}
