import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import {
  verifyPendingToken,
  decryptTotpSecret,
  verifyTotpCode,
  issuePlatformAdminSession,
} from '@/lib/platform-admin-auth'
import {
  getClientIp,
  logPlatformAudit,
  AUDIT_ACTIONS,
  isPlatformAdminProfile,
} from '@/lib/platform-admin'
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginRateLimit,
} from '@/lib/login-rate-limit'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
const err = (msg, s = 400) => json({ error: msg }, s)

export async function POST(request) {
  try {
    const b = await request.json()
    const pending = verifyPendingToken(b.pending_token)
    if (!pending) return notFound()
    if (!b.code) return err('Verification code required')

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ id: pending.uid })
    if (!profile || !isPlatformAdminProfile(profile) || !profile.totp_enabled) return notFound()

    const ip = getClientIp(request)
    const rate = await checkLoginRateLimit(db, profile.email, ip)
    if (rate.locked) {
      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.LOGIN_LOCKED,
        meta: { ip, locked_until: rate.lockedUntil },
      })
      return err('Too many attempts. Try again later.', 429)
    }

    const secret = decryptTotpSecret(profile.totp_secret_enc)
    if (!secret || !verifyTotpCode(secret, b.code)) {
      await recordLoginFailure(db, profile.email, ip)
      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.LOGIN_TOTP_FAILED,
        meta: { ip },
      })
      return err('Invalid verification code', 401)
    }

    await clearLoginRateLimit(db, profile.email, ip)
    await db.collection('profiles').updateOne(
      { id: profile.id },
      { $set: { last_login_at: new Date() } }
    )
    issuePlatformAdminSession(profile)

    await logPlatformAudit(db, {
      actor: profile,
      action: AUDIT_ACTIONS.LOGIN_TOTP_SUCCESS,
      meta: { ip },
    })

    return json({ ok: true, is_platform_admin: true })
  } catch (e) {
    console.error('Verify TOTP error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
