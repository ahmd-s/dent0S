import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
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

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, db } = ctx
  const cid = profile.clinic_id

  const blocks = await db.collection('block_times').find({
    clinic_id: cid,
    is_active: { $ne: false }
  }).sort({ date: 1, start_time: 1 }).toArray()

  // Enrich with doctor names
  const doctorIds = [...new Set(blocks.map(b => b.doctor_id).filter(Boolean))]
  const doctors = doctorIds.length > 0 
    ? await db.collection('profiles').find({ id: { $in: doctorIds } }).toArray()
    : []
  const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d.full_name]))

  const enriched = blocks.map(b => ({
    ...b,
    doctor_name: b.doctor_id ? doctorMap[b.doctor_id] || 'Unknown' : 'All Doctors'
  }))

  return json({ blocks: enriched })
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, db } = ctx
  const cid = profile.clinic_id

  const body = await request.json()
  if (!body.doctor_id || !body.date || !body.start_time || !body.end_time || !body.reason) {
    return err('Missing required fields: doctor_id, date, start_time, end_time, reason')
  }

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return err('Invalid date format. Use YYYY-MM-DD')
  }

  // Validate time format HH:MM
  if (!/^\d{2}:\d{2}$/.test(body.start_time) || !/^\d{2}:\d{2}$/.test(body.end_time)) {
    return err('Invalid time format. Use HH:MM (24-hour)')
  }

  // Validate start < end
  if (body.start_time >= body.end_time) {
    return err('End time must be after start time')
  }

  const id = uuidv4()
  await db.collection('block_times').insertOne({
    id,
    clinic_id: cid,
    doctor_id: body.doctor_id,
    date: body.date,
    start_time: body.start_time,
    end_time: body.end_time,
    reason: body.reason,
    source: 'manual',
    created_by: profile.id,
    created_at: new Date(),
    is_active: true
  })

  return json({ ok: true, id })
}
