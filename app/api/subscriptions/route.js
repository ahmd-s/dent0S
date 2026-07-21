import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { canAccessSettings } from '@/lib/rbac'

const json = (d, s=200) => NextResponse.json(d, { status: s })
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  return { profile, db }
}

export async function GET() {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, db } = ctx
  const subscription = await db.collection('subscriptions').findOne({ clinic_id: profile.clinic_id })
  if (!subscription) return json({ subscription: null })
  let trial_days_remaining = 0
  if (subscription.subscription_status === 'trial' && subscription.trial_end) {
    const diff = new Date(subscription.trial_end) - new Date()
    trial_days_remaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }
  return json({ subscription: clean(subscription), trial_days_remaining })
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, db } = ctx
  if (!canAccessSettings(profile)) return err('Admins only', 403)
  const { plan_type, razorpay_subscription_id, razorpay_plan_id } = await request.json()
  if (!plan_type || !['monthly', 'yearly'].includes(plan_type)) return err('Invalid plan_type')
  const now = new Date()
  const periodEnd = new Date(now)
  if (plan_type === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1)
  else periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  await db.collection('subscriptions').updateOne(
    { clinic_id: profile.clinic_id },
    { $set: { plan_type, subscription_status: 'active', razorpay_subscription_id: razorpay_subscription_id || null, razorpay_plan_id: razorpay_plan_id || null, current_period_start: now, current_period_end: periodEnd, cancel_at_period_end: false, updated_at: now } },
    { upsert: true }
  )
  return json({ ok: true })
}
