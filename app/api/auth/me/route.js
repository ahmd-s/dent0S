import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { isPlatformAdminProfile } from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)
const clean = o => {
  if (!o) return o
  const {
    _id,
    password_hash,
    email_verification_token_hash,
    totp_secret_enc,
    totp_pending_secret_enc,
    ...rest
  } = o
  return rest
}

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  if (isPlatformAdminProfile(profile)) {
    return { profile, clinic: null, db, token: t }
  }
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db, token: t }
}

export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    const isPA = isPlatformAdminProfile(ctx.profile)
    return json({
      user: { id: ctx.profile.id, email: ctx.profile.email },
      profile: clean(ctx.profile),
      clinic: clean(ctx.clinic),
      is_platform_admin: isPA,
      platform_session_active: isPA && !!ctx.token?.pa,
    })
  } catch (e) {
    console.error('Auth me error:', e)
    return err('Internal server error', 500)
  }
}
