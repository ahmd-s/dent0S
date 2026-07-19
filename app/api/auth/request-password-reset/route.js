import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { generateResetToken, hashResetToken } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/invite-email'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

const GENERIC_MESSAGE = 'If an account exists for that email, a reset link has been sent.'

export async function POST(request) {
  try {
    const b = await request.json()
    const email = (b.email || '').toLowerCase().trim()
    if (!email) return err('Email required')

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ email, is_active: true })

    if (profile) {
      const token = generateResetToken()
      await db.collection('profiles').updateOne(
        { id: profile.id },
        {
          $set: {
            password_reset_token_hash: hashResetToken(token),
            password_reset_expires_at: new Date(Date.now() + 60 * 60 * 1000),
          },
        }
      )
      const origin = new URL(request.url).origin
      const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`
      const emailResult = await sendPasswordResetEmail({ to: email, resetUrl })
      if (!emailResult?.sent) {
        console.error('Password reset email not sent:', emailResult?.reason || 'unknown')
      }
    }

    return json({ ok: true, message: GENERIC_MESSAGE })
  } catch (e) {
    console.error('Request password reset error:', e)
    return err('Internal server error', 500)
  }
}
