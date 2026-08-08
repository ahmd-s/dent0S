import { NextResponse } from 'next/server'
import { requirePlatformAdmin, LIFECYCLE_STATUSES } from '@/lib/platform-admin'
import { applyLifecycle } from '@/lib/subscription-engine'

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

export async function POST(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const b = await request.json()
    const { status, reason, force = false } = b

    if (!status || !LIFECYCLE_STATUSES.includes(status)) {
      return err(`status must be one of: ${LIFECYCLE_STATUSES.join(', ')}`)
    }

    const result = await applyLifecycle(db, profile, params.id, { status, reason, force })
    if (!result.ok) {
      const httpStatus = result.code === 'INVALID_TRANSITION' ? 422 : 400
      return json({ error: result.error, code: result.code }, httpStatus)
    }

    const { state } = result
    return json({
      ok: true,
      status,
      subscription_status: state.clinicStatus,
      billing_status: state.billingStatus,
      platform_status: state.platformStatus,
      subscription_reason: state.subscriptionReason,
      trial_auto_enforcement: state.trialAutoEnforcement,
    })
  } catch (e) {
    console.error('Platform admin lifecycle error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
