import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { toDateTime, toDateOnly, toTimeOnly } from '@/lib/blocked-slots'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

const clinicalAccess = p => p?.role === 'admin' || p?.role === 'doctor'
const isReceptionist = p => p?.role === 'receptionist'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function PUT(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, clinic, db } = ctx
  const cid = profile.clinic_id
  const blockedSlotId = params.id

  if (isReceptionist(profile)) return err('Forbidden', 403)

  const existing = await db.collection('blocked_slots').findOne({ id: blockedSlotId, clinic_id: cid })
  if (!existing) return err('Blocked slot not found', 404)

  // Permission check: doctors can only edit their own slots
  if (profile.role === 'doctor' && existing.doctor_id !== profile.id) {
    return err('Doctors can only manage their own availability', 403)
  }

  const body = await request.json()
  const update = {}

  if (body.date || body.start_time || body.end_time) {
    const date = body.date || toDateOnly(existing.start_datetime)
    const start_time = body.start_time || toTimeOnly(existing.start_datetime)
    const end_time = body.end_time || toTimeOnly(existing.end_datetime)

    const start_datetime = toDateTime(date, start_time)
    const end_datetime = toDateTime(date, end_time)

    if (start_datetime >= end_datetime) {
      return err('End time must be after start time')
    }

    update.start_datetime = start_datetime
    update.end_datetime = end_datetime
  }

  if ('title' in body) update.title = body.title
  if ('notes' in body) update.notes = body.notes
  if ('is_active' in body) update.is_active = body.is_active

  await db.collection('blocked_slots').updateOne(
    { id: blockedSlotId, clinic_id: cid },
    { $set: update }
  )

  const updated = await db.collection('blocked_slots').findOne({ id: blockedSlotId, clinic_id: cid })

  return json({ ok: true, blocked_slot: clean(updated) })
}

export async function DELETE(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, clinic, db } = ctx
  const cid = profile.clinic_id
  const blockedSlotId = params.id

  if (isReceptionist(profile)) return err('Forbidden', 403)

  const existing = await db.collection('blocked_slots').findOne({ id: blockedSlotId, clinic_id: cid })
  if (!existing) return err('Blocked slot not found', 404)

  // Permission check: doctors can only delete their own slots
  if (profile.role === 'doctor' && existing.doctor_id !== profile.id) {
    return err('Doctors can only manage their own availability', 403)
  }

  await db.collection('blocked_slots').deleteOne({ id: blockedSlotId, clinic_id: cid })

  return json({ ok: true })
}
