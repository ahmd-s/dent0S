import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import {
  readGoogleSignupPendingCookie,
  clearGoogleSignupPendingCookie,
} from '@/lib/google-oauth-cookies'
import { createClinicOwnerAccount } from '@/lib/create-clinic-owner'
import { issueClinicSession } from '@/lib/clinic-session'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)

export async function POST(request) {
  try {
    const pending = readGoogleSignupPendingCookie()
    if (!pending) return err('Google sign-up session expired. Please sign in with Google again.', 401)

    const b = await request.json()
    const clinic_name = (b.clinic_name || '').trim()
    const phone = String(b.phone || '').replace(/\D/g, '').slice(0, 10)

    if (!clinic_name) return err('Clinic name is required')
    if (!/^\d{10}$/.test(phone)) return err('Phone must be exactly 10 digits')

    const db = await getDb()
    const email = pending.email.toLowerCase().trim()
    if (await db.collection('profiles').findOne({ email })) {
      clearGoogleSignupPendingCookie()
      return err('Email already registered. Sign in with Google from the login page.', 409)
    }

    const profile = await createClinicOwnerAccount(db, {
      email,
      full_name: pending.full_name,
      phone,
      clinic_name,
      google_sub: pending.google_sub,
      email_verified: true,
    })

    clearGoogleSignupPendingCookie()
    const { onboarding_complete } = await issueClinicSession(db, profile)

    return json({
      ok: true,
      onboarding_complete,
    })
  } catch (e) {
    console.error('Google complete-signup error:', e)
    return err('Internal server error', 500)
  }
}
