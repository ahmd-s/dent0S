import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

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
    const db = await getDb()
    const inv = await db.collection('invoices').findOne({ share_token: params.shareToken })
    if (!inv) return err('Not found', 404)
    const clinic = await db.collection('clinics').findOne({ id: inv.clinic_id })
    if (!clinic) return err('Clinic not found', 404)
    const [p, items, visit] = await Promise.all([
      db.collection('patients').findOne({ id: inv.patient_id }),
      db.collection('invoice_items').find({ invoice_id: inv.id }).toArray(),
      db.collection('visits').findOne({ id: inv.visit_id })
    ])
    const doctor = visit?.doctor_id ? await db.collection('profiles').findOne({ id: visit.doctor_id }) : null
    const { items: _invItems, ...cleanInv } = clean(inv)
    return json({ invoice: { ...cleanInv, patient: clean(p), items: items.map(clean), visit: visit ? clean(visit) : null, doctor_name: doctor?.full_name || '', clinic: clean(clinic) } })
  } catch (e) {
    console.error('Public invoice GET error:', e)
    return err('Internal server error', 500)
  }
}
