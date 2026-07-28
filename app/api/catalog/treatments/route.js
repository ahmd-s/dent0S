<<<<<<< HEAD
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'

const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

export async function GET(request) {
  const db = await getDb()
  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  const filter = q ? { treatment_name: { $regex: q, $options: 'i' } } : {}
  const treatments = await db.collection('master_treatments').find(filter).limit(15).toArray()
  
  const res = NextResponse.json({ treatments: treatments.map(clean) })
=======
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

function cors(res) {
>>>>>>> 1b2c9765788c77fa7ef45790a326d40d9aa5c607
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
<<<<<<< HEAD
=======
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

export async function GET(request) {
  try {
    const db = await getDb()
    const url = new URL(request.url)
    const q = url.searchParams.get('q') || ''
    const filter = q ? { treatment_name: { $regex: q, $options: 'i' } } : {}
    const treatments = await db.collection('master_treatments').find(filter).limit(15).toArray()
    return json({ treatments: treatments.map(clean) })
  } catch (e) {
    console.error('Catalog treatments error:', e)
    return err('Internal server error', 500)
  }
}
>>>>>>> 1b2c9765788c77fa7ef45790a326d40d9aa5c607
