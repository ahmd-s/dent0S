import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { canAccessSettings } from '@/lib/rbac'
import Razorpay from 'razorpay'
import {
  isActivePaidSubscription,
  trialDaysRemaining,
  trialEndsAtFromClinic,
} from '@/lib/subscription-helpers'
import { activateSubscription } from '@/lib/subscription-engine'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

const json = (d, s=200) => NextResponse.json(d, { status: s })
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

function deriveDisplayStatus(clinic, subscription) {
  if (clinic?.subscription_status === 'blocked') return 'blocked'
  if (isActivePaidSubscription(subscription)) return 'active'
  if (subscription?.subscription_status === 'trial') return 'trial'
  if (subscription?.subscription_status) return subscription.subscription_status
  return 'trial'
}

export async function GET() {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, clinic, db } = ctx
  const subscription = await db.collection('subscriptions').findOne({ clinic_id: profile.clinic_id })
  const trial_days_remaining = trialDaysRemaining(clinic, subscription)
  const display_status = deriveDisplayStatus(clinic, subscription)
  const trial_ends_at = trialEndsAtFromClinic(clinic, subscription)
  const is_admin = canAccessSettings(profile)

  return json({
    subscription: subscription ? clean(subscription) : null,
    clinic_access: clean({
      subscription_status: clinic?.subscription_status || 'active',
      trial_ends_at,
      subscription_exempt: clinic?.subscription_exempt === true,
    }),
    trial_days_remaining,
    display_status,
    is_paid_active: isActivePaidSubscription(subscription),
    is_admin,
  })
}

async function fetchRazorpaySubscription(razorpaySubscriptionId) {
  if (!razorpaySubscriptionId) return null
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })
  try {
    return await razorpay.subscriptions.fetch(razorpaySubscriptionId)
  } catch (e) {
    console.error('Razorpay fetch subscription error:', e)
    return null
  }
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, db } = ctx
  if (!canAccessSettings(profile)) return err('Admins only', 403)
  const { plan_type, razorpay_subscription_id, razorpay_plan_id } = await request.json()
  if (!plan_type || !['monthly', 'yearly'].includes(plan_type)) return err('Invalid plan_type')
  if (!razorpay_subscription_id) return err('razorpay_subscription_id required')

  const rpSub = await fetchRazorpaySubscription(razorpay_subscription_id)
  const allowedStatuses = ['active', 'authenticated', 'created']
  if (rpSub && !allowedStatuses.includes(rpSub.status)) {
    return err('Subscription payment not completed yet', 400)
  }

  const now = new Date()
  let periodEnd = new Date(now)
  if (rpSub?.current_end) {
    periodEnd = new Date(rpSub.current_end * 1000)
  } else if (plan_type === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  }

  await activateSubscription(db, profile.clinic_id, {
    periodEnd,
    periodStart: now,
    planType: plan_type,
    razorpaySubId: razorpay_subscription_id,
    razorpayPlanId: razorpay_plan_id || rpSub?.plan_id || null,
    lastPaymentDate: now,
    clearGrace: true,
  })
  return json({ ok: true })
}
