import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
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

export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, clinic, db } = ctx
  const cid = profile.clinic_id

  const url = new URL(request.url)
  const doctor_id = url.searchParams.get('doctor_id')
  const start_date = url.searchParams.get('start_date')
  const end_date = url.searchParams.get('end_date')

  const filter = { clinic_id: cid, is_active: true }
  if (doctor_id) filter.doctor_id = doctor_id
  if (start_date) filter.start_datetime = { $gte: new Date(start_date + 'T00:00:00') }
  if (end_date) filter.end_datetime = { $lte: new Date(end_date + 'T23:59:59') }

  const blockedSlots = await db.collection('blocked_slots')
    .find(filter)
    .sort({ start_datetime: 1 })
    .toArray()

  // Enrich with doctor names
  const doctorIds = [...new Set(blockedSlots.map(bs => bs.doctor_id).filter(Boolean))]
  const doctors = doctorIds.length > 0 
    ? await db.collection('profiles').find({ id: { $in: doctorIds } }).toArray()
    : []
  const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d.full_name]))

  return json({
    blocked_slots: blockedSlots.map(bs => ({
      ...clean(bs),
      doctor_name: doctorMap[bs.doctor_id] || null,
      date: toDateOnly(bs.start_datetime),
      start_time: toTimeOnly(bs.start_datetime),
      end_time: toTimeOnly(bs.end_datetime)
    }))
  })
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, clinic, db } = ctx
  const cid = profile.clinic_id

  if (isReceptionist(profile)) return err('Forbidden', 403)

  const body = await request.json()
  if (!body.doctor_id || !body.date || !body.start_time || !body.end_time) {
    return err('Missing required fields: doctor_id, date, start_time, end_time')
  }

  // Permission check: doctors can only block their own slots
  if (profile.role === 'doctor' && body.doctor_id !== profile.id) {
    return err('Doctors can only manage their own availability', 403)
  }

  const start_datetime = toDateTime(body.date, body.start_time)
  const end_datetime = toDateTime(body.date, body.end_time)

  console.log('Saving block:', {
    start_datetime: start_datetime,
    end_datetime: end_datetime,
    doctor_id: body.doctor_id
  })

  if (start_datetime >= end_datetime) {
    return err('End time must be after start time')
  }

  const id = uuidv4()
  const blockedSlot = {
    id,
    clinic_id: cid,
    doctor_id: body.doctor_id,
    start_datetime,
    end_datetime,
    source: 'manual',
    title: body.title || 'Blocked',
    notes: body.notes || '',
    created_by: profile.id,
    created_at: new Date(),
    is_active: true
  }

  await db.collection('blocked_slots').insertOne(blockedSlot)

  return json({ ok: true, blocked_slot: clean(blockedSlot) })
}
