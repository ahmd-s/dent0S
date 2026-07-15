import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import slugify from 'slugify'
import { getDb } from '@/lib/mongo'
import { hashPassword, signToken, setAuthCookie, getCurrentUser } from '@/lib/auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function POST(request) {
  try {
    const db = await getDb()
    const b = await request.json()
    const required = ['full_name','email','phone','clinic_name','password']
    if (required.some(k=>!b[k])) return err('Missing fields')
    const email = b.email.toLowerCase().trim()
    if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
    const userId = uuidv4(), clinicId = uuidv4()
    const slug = slugify(b.clinic_name, { lower: true, strict: true }) + '-' + Math.floor(1000+Math.random()*9000)
    await db.collection('clinics').insertOne({ id: clinicId, name: b.clinic_name, slug, owner_id: userId, phone: b.phone, address:'', city:'', gstin:'', logo_url:'', working_hours:null, subscription_plan:'free', is_active:true, onboarding_complete:false, created_at:new Date() })
    await db.collection('profiles').insertOne({ id: userId, clinic_id: clinicId, email, password_hash: await hashPassword(b.password), full_name: b.full_name, role:'admin', phone: b.phone, is_active:true, created_at:new Date() })
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    await db.collection('subscriptions').insertOne({
      clinic_id: clinicId,
      subscription_status: 'trial',
      plan_type: null,
      trial_start: now,
      trial_end: trialEnd,
      razorpay_subscription_id: null,
      razorpay_plan_id: null,
      razorpay_customer_id: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      cancelled_at: null,
      grace_period_end: null,
      last_payment_date: null,
      last_payment_amount: null,
      created_at: now,
      updated_at: now
    })
    setAuthCookie(signToken({ uid: userId, cid: clinicId, role:'admin' }))
    return json({ ok:true })
  } catch (e) {
    console.error('Auth signup error:', e)
    return err('Internal server error', 500)
  }
}
