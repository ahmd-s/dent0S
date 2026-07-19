import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { generateResetToken, hashResetToken } from '@/lib/auth'
import { sendEmailVerificationEmail } from '@/lib/invite-email'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

const GENERIC_MESSAGE = 'If an unverified account exists for that email, a verification link has been sent.'

export async function POST(request) {
  try {
    const b = await request.json()
    const email = (b.email || '').toLowerCase().trim()
    if (!email) return err('Email required')

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ email, email_verified: false })

    if (profile) {
      const token = generateResetToken()
      await db.collection('profiles').updateOne(
        { id: profile.id },
        {
          $set: {
            email_verification_token_hash: hashResetToken(token),
            email_verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        }
      )
      const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
      const origin = new URL(request.url).origin
      const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`
      const emailResult = await sendEmailVerificationEmail({
        to: email,
        verifyUrl,
        clinicName: clinic?.name,
      })
      if (!emailResult?.sent) {
        console.error('Verification email not sent:', emailResult?.reason || 'unknown')
      }
    }

    return json({ ok: true, message: GENERIC_MESSAGE })
  } catch (e) {
    console.error('Resend verification error:', e)
    return err('Internal server error', 500)
  }
}
