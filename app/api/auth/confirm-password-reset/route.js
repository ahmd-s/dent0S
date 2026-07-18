import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { hashPassword, hashResetToken } from '@/lib/auth'

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
    const password = b.password || ''

    if (!token) return err('Reset token required')
    if (password.length < 8) return err('Password must be at least 8 characters')

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({
      password_reset_token_hash: hashResetToken(token),
      password_reset_expires_at: { $gt: new Date() },
    })

    if (!profile) return err('Invalid or expired reset link', 400)

    await db.collection('profiles').updateOne(
      { id: profile.id },
      {
        $set: { password_hash: await hashPassword(password) },
        $unset: { password_reset_token_hash: '', password_reset_expires_at: '' },
      }
    )

    return json({ ok: true })
  } catch (e) {
    console.error('Confirm password reset error:', e)
    return err('Internal server error', 500)
  }
}
