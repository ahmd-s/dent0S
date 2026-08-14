import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { recordManualPayment, activateSubscription } from '@/lib/subscription-engine'

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

    const b = await request.json()
    const result = await recordManualPayment(db, profile, params.id, {
      date: b.date,
      amount: b.amount,
      method: b.method,
      note: b.note,
    })

    if (!result.ok) return err(result.error)

    const paymentDate = new Date(b.date)
    const sub = await db.collection('subscriptions').findOne({ clinic_id: params.id })
    const planType = sub?.plan_type || 'monthly'
    const periodEnd = new Date(paymentDate)
    if (planType === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    const activation = await activateSubscription(db, params.id, {
      periodEnd,
      periodStart: paymentDate,
      planType,
      lastPaymentDate: paymentDate,
      clearGrace: true,
      reason: 'manual_payment',
      clearEmergencyLock: true,
    })
    if (!activation.ok) return err(activation.error)

    const state = activation.state
    return json({
      ok: true,
      payment: clean(result.payment),
      subscription_status: state.clinicStatus,
      billing_status: state.billingStatus,
      subscription_reason: state.subscriptionReason,
      grace_period_end: state.graceEndsAt,
    })
  } catch (e) {
    console.error('Platform admin payments POST error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
