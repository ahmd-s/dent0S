import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import Razorpay from 'razorpay'

const json = (d, s=200) => NextResponse.json(d, { status: s })
const err = (msg, s=400) => json({ error: msg }, s)

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile } = ctx
  if (profile.role !== 'admin') return err('Admins only', 403)
  const { plan_type } = await request.json()
  if (!plan_type || !['monthly', 'yearly'].includes(plan_type)) return err('Invalid plan_type')
  const planId = plan_type === 'monthly'
    ? process.env.RAZORPAY_MONTHLY_PLAN_ID
    : process.env.RAZORPAY_YEARLY_PLAN_ID
  if (!planId) return err('Plan not configured', 500)
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })
  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 12,
      notes: { clinic_id: profile.clinic_id, plan_type }
    })
    return json({
      subscription_id: subscription.id,
      plan_id: planId,
      razorpay_key: process.env.RAZORPAY_KEY_ID,
      plan_type
    })
  } catch (e) {
    console.error('Razorpay error:', e)
    return err('Failed to create subscription', 500)
  }
}
