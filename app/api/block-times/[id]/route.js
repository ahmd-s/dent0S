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

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function DELETE(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, db } = ctx
  const cid = profile.clinic_id

  const id = params.id

  const result = await db.collection('block_times').updateOne(
    { id, clinic_id: cid },
    { $set: { is_active: false } }
  )

  if (result.matchedCount === 0) {
    return err('Block not found', 404)
  }

  return json({ ok: true })
}

export async function PUT(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, db } = ctx
  const cid = profile.clinic_id

  const id = params.id
  const body = await request.json()

  // Validate date format if provided
  if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return err('Invalid date format. Use YYYY-MM-DD')
  }

  // Validate time format if provided
  if (body.start_time && !/^\d{2}:\d{2}$/.test(body.start_time)) {
    return err('Invalid start_time format. Use HH:MM (24-hour)')
  }
  if (body.end_time && !/^\d{2}:\d{2}$/.test(body.end_time)) {
    return err('Invalid end_time format. Use HH:MM (24-hour)')
  }

  // Validate start < end if both provided
  if (body.start_time && body.end_time && body.start_time >= body.end_time) {
    return err('End time must be after start time')
  }

  const update = {}
  if (body.date !== undefined) update.date = body.date
  if (body.start_time !== undefined) update.start_time = body.start_time
  if (body.end_time !== undefined) update.end_time = body.end_time
  if (body.reason !== undefined) update.reason = body.reason

  const result = await db.collection('block_times').updateOne(
    { id, clinic_id: cid },
    { $set: update }
  )

  if (result.matchedCount === 0) {
    return err('Block not found', 404)
  }

  return json({ ok: true })
}
