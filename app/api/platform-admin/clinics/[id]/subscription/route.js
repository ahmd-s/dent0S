import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { setPlatformOverride } from '@/lib/subscription-engine'
import {
  changeClinicPlan,
  extendClinicTrial,
  markClinicPaid,
  pauseClinicSubscription,
  resumeClinicSubscription,
} from '@/lib/platform-admin-console'

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

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const b = await request.json()
    const action = b.action || (b.platform_status !== undefined ? 'override' : null)

    if (action === 'change_plan') {
      const result = await changeClinicPlan(db, profile, params.id, { planType: b.plan_type })
      if (!result.ok) return err(result.error)
      return json({ ok: true, plan_type: result.plan_type })
    }

    if (action === 'extend_trial') {
      const result = await extendClinicTrial(db, profile, params.id, { days: b.days ?? 14 })
      if (!result.ok) return err(result.error)
      return json({ ok: true, trial_ends_at: result.state?.trialEndsAt || null })
    }

    if (action === 'pause') {
      const result = await pauseClinicSubscription(db, profile, params.id, { reason: b.reason })
      if (!result.ok) return err(result.error)
      return json({ ok: true, subscription_status: result.state?.clinicStatus })
    }

    if (action === 'resume') {
      const result = await resumeClinicSubscription(db, profile, params.id)
      if (!result.ok) return err(result.error)
      return json({ ok: true, subscription_status: result.state?.clinicStatus })
    }

    if (action === 'mark_paid') {
      const result = await markClinicPaid(db, profile, params.id, {
        amount: b.amount,
        method: b.method || 'manual',
        date: b.date,
        note: b.note,
        planType: b.plan_type,
      })
      if (!result.ok) return err(result.error)
      return json({ ok: true, payment: result.payment })
    }

    if (action === 'override' || b.platform_status !== undefined) {
      const result = await setPlatformOverride(db, profile, params.id, { platformStatus: b.platform_status })
      if (!result.ok) return err(result.error)
      return json({ ok: true, platform_status: result.state.platformStatus })
    }

    return err('Unknown subscription action')
  } catch (e) {
    console.error('Platform admin subscription update error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
