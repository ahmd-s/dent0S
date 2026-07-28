import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import {
  requirePlatformAdmin,
  logPlatformAudit,
  AUDIT_ACTIONS,
} from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
const err = (msg, s = 400) => json({ error: msg }, s)
const clean = o => {
  if (!o) return o
  const { _id, ...rest } = o
  return rest
}

export async function GET(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const payments = await db.collection('clinic_manual_payments')
      .find({ clinic_id: params.id })
      .sort({ date: -1, recorded_at: -1 })
      .toArray()

    return json({ payments: payments.map(clean) })
  } catch (e) {
    console.error('Platform admin payments GET error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const b = await request.json()
    if (!b.date || b.amount == null || b.amount === '' || !b.method?.trim()) {
      return err('date, amount, and method are required')
    }
    const amount = Number(b.amount)
    if (!Number.isFinite(amount) || amount < 0) return err('Invalid amount')

    const now = new Date()
    const entry = {
      id: uuidv4(),
      clinic_id: params.id,
      date: b.date,
      amount,
      method: String(b.method).trim(),
      note: b.note ? String(b.note).trim() : '',
      recorded_by_id: profile.id,
      recorded_by_email: profile.email || '',
      recorded_at: now,
    }

    await db.collection('clinic_manual_payments').insertOne(entry)

    await logPlatformAudit(db, {
      actor: profile,
      action: AUDIT_ACTIONS.MANUAL_PAYMENT_RECORDED,
      targetClinicId: clinic.id,
      targetClinicName: clinic.name,
      meta: {
        amount: entry.amount,
        method: entry.method,
        date: entry.date,
        note: entry.note || null,
      },
    })

    return json({ ok: true, payment: clean(entry) })
  } catch (e) {
    console.error('Platform admin payments POST error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
