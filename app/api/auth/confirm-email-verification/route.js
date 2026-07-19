import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { hashResetToken } from '@/lib/auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

export async function POST(request) {
  try {
    const b = await request.json()
    const token = (b.token || '').trim()
    if (!token) return err('Verification token required')

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({
      email_verification_token_hash: hashResetToken(token),
      email_verification_expires_at: { $gt: new Date() },
      email_verified: false,
    })

    if (!profile) return err('Invalid or expired verification link', 400)

    await db.collection('profiles').updateOne(
      { id: profile.id },
      {
        $set: { email_verified: true },
        $unset: { email_verification_token_hash: '', email_verification_expires_at: '' },
      }
    )

    return json({ ok: true })
  } catch (e) {
    console.error('Confirm email verification error:', e)
    return err('Internal server error', 500)
  }
}
