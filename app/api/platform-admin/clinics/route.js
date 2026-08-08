import { NextResponse } from 'next/server'
import { DEFAULT_FEATURES, requirePlatformAdmin } from '@/lib/platform-admin'
import { graceDaysRemaining, isInGracePeriod } from '@/lib/subscription-helpers'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const clinics = await db.collection('clinics').find({}).sort({ created_at: -1 }).toArray()
    const clinicIds = clinics.map(c => c.id)

    const [subscriptions, staffLogins, visitActivity] = await Promise.all([
      db.collection('subscriptions').find({ clinic_id: { $in: clinicIds } }).toArray(),
      db.collection('profiles').aggregate([
        { $match: { clinic_id: { $in: clinicIds }, deleted_at: { $exists: false } } },
        { $group: { _id: '$clinic_id', last_staff_login: { $max: '$last_login_at' } } },
      ]).toArray(),
      db.collection('visits').aggregate([
        { $match: { clinic_id: { $in: clinicIds } } },
        { $group: { _id: '$clinic_id', last_visit_date: { $max: '$visit_date' } } },
      ]).toArray(),
    ])

    const subMap = Object.fromEntries(subscriptions.map(s => [s.clinic_id, s]))
    const loginMap = Object.fromEntries(staffLogins.map(r => [r._id, r.last_staff_login]))
    const visitMap = Object.fromEntries(visitActivity.map(r => [r._id, r.last_visit_date]))

    const rows = clinics.map(c => {
      const sub = subMap[c.id] || {}
      const lastStaffLogin = loginMap[c.id] || null
      const lastVisitDate = visitMap[c.id] || null
      const lastActivity = [lastStaffLogin, lastVisitDate ? new Date(lastVisitDate) : null]
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null

      const inGrace = isInGracePeriod(sub)
      const graceDays = graceDaysRemaining(sub)

      return {
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        is_active: c.is_active !== false,
        onboarding_complete: !!c.onboarding_complete,
        plan_type: sub.plan_type || null,
        subscription_status: c.subscription_status === 'blocked' ? 'blocked' : 'active',
        billing_status: sub.subscription_status || null,
        platform_status: sub.platform_status ?? null,
        subscription_reason: sub.subscription_reason || null,
        monthly_ai_usage_limit: c.monthly_ai_usage_limit ?? null,
        trial_auto_enforcement: c.trial_auto_enforcement || 'auto',
        manual_access_granted_at: c.manual_access_granted_at || null,
        last_staff_login: lastStaffLogin,
        last_visit_date: lastVisitDate,
        last_activity: lastActivity,
        // Sprint 2: extended fields
        trial_ends_at: c.trial_ends_at || null,
        current_period_end: sub.current_period_end || null,
        grace_period_end: sub.grace_period_end || null,
        grace_days_remaining: inGrace ? graceDays : null,
        days_remaining: inGrace ? graceDays : null,
        subscription_id: sub.razorpay_subscription_id || sub.subscription_id || null,
        customer_id: sub.razorpay_customer_id || sub.customer_id || null,
        payment_method: sub.payment_method || null,
        features: c.features || DEFAULT_FEATURES,
        emergency_locked_at: c.emergency_locked_at || null,
        emergency_locked_by: c.emergency_locked_by || null,
        emergency_locked_reason: c.emergency_locked_reason || null,
        is_in_grace: inGrace,
        is_payment_failed: sub.subscription_status === 'halted' || sub.subscription_reason === 'payment_failed',
        is_comped: sub.platform_status === 'comped',
        is_emergency_locked: c.subscription_status === 'blocked' && !!c.emergency_locked_at,
        is_manual_override: ['force_active', 'force_trial', 'active'].includes(sub.platform_status),
      }
    })

    return json({ clinics: rows })
  } catch (e) {
    console.error('Platform admin clinics error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
