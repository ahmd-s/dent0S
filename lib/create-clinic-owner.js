import { v4 as uuidv4 } from 'uuid'
import slugify from 'slugify'
import crypto from 'crypto'
import { hashPassword } from '@/lib/auth'

/**
 * Create clinic + owner profile + subscription (mirrors email signup documents).
 */
export async function createClinicOwnerAccount(db, {
  email,
  full_name,
  phone,
  clinic_name,
  google_sub,
  email_verified = true,
}) {
  const userId = uuidv4()
  const clinicId = uuidv4()
  const slug =
    slugify(clinic_name, { lower: true, strict: true }) +
    '-' +
    Math.floor(1000 + Math.random() * 9000)
  const now = new Date()
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const randomPassword = crypto.randomBytes(32).toString('base64url')

  await db.collection('clinics').insertOne({
    id: clinicId,
    name: clinic_name,
    slug,
    owner_id: userId,
    phone,
    address: '',
    city: '',
    gstin: '',
    logo_url: '',
    working_hours: null,
    subscription_plan: 'free',
    is_active: true,
    onboarding_complete: false,
    subscription_status: 'active',
    monthly_ai_usage_limit: null,
    trial_ends_at: trialEnd,
    subscription_exempt: false,
    trial_auto_enforcement: 'auto',
    created_at: now,
  })

  const profileDoc = {
    id: userId,
    clinic_id: clinicId,
    email: email.toLowerCase().trim(),
    password_hash: await hashPassword(randomPassword),
    full_name,
    role: 'admin',
    phone,
    is_active: true,
    email_verified,
    created_at: now,
  }
  if (google_sub) profileDoc.google_sub = google_sub

  await db.collection('profiles').insertOne(profileDoc)

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
    updated_at: now,
  })

  return profileDoc
}
