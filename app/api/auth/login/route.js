import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import {
  verifyPassword,
  signToken,
  setAuthCookie,
  requiresEmailVerification,
} from '@/lib/auth'
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginRateLimit,
} from '@/lib/login-rate-limit'
import {
  getClientIp,
  logPlatformAudit,
  AUDIT_ACTIONS,
  isPlatformAdminProfile,
} from '@/lib/platform-admin'
import { issuePendingToken } from '@/lib/platform-admin-auth'
import { ensureProfileRolesMigrated } from '@/lib/profile-roles'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)

function getMongoEnvHint() {
  const url = process.env.MONGO_URL || ''
  return {
    present: url.length > 0,
    length: url.length,
    looksLocalhost: /localhost|127\.0\.0\.1/.test(url),
    dbName: process.env.DB_NAME || '(unset)',
  }
}

function loginErrorResponse(message, status, debugData) {
  const res = json({ error: message }, status)
  if (debugData) {
    res.headers.set('X-Login-Debug', JSON.stringify(debugData))
  }
  return res
}

export async function POST(request) {
  // #region agent log
  fetch('http://127.0.0.1:7366/ingest/f3641e0b-1a49-4955-8e0b-16987fcc4471',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'87f42d'},body:JSON.stringify({sessionId:'87f42d',location:'app/api/auth/login/route.js:POST:entry',message:'login POST start',data:{mongo:getMongoEnvHint(),hasJwtSecret:!!process.env.JWT_SECRET},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const db = await getDb()
    // #region agent log
    fetch('http://127.0.0.1:7366/ingest/f3641e0b-1a49-4955-8e0b-16987fcc4471',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'87f42d'},body:JSON.stringify({sessionId:'87f42d',location:'app/api/auth/login/route.js:POST:db',message:'getDb ok',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const b = await request.json()
    if (!b.email || !b.password) return err('Email and password required')
    const email = b.email.toLowerCase().trim()
    const ip = getClientIp(request)

    const rate = await checkLoginRateLimit(db, email, ip)
    if (rate.locked) {
      const profile = await db.collection('profiles').findOne({ email })
      if (isPlatformAdminProfile(profile)) {
        await logPlatformAudit(db, {
          actor: profile,
          action: AUDIT_ACTIONS.LOGIN_LOCKED,
          meta: { ip, locked_until: rate.lockedUntil },
        })
      }
      return err('Too many attempts. Try again later.', 429)
    }

    const profile = await db.collection('profiles').findOne({ email })
    if (!profile || !profile.is_active || profile.deleted_at) {
      const failResult = await recordLoginFailure(db, email, ip)
      if (isPlatformAdminProfile(profile)) {
        await logPlatformAudit(db, {
          actor: profile,
          action: AUDIT_ACTIONS.LOGIN_PASSWORD_FAILED,
          meta: { ip },
        })
      }
      if (failResult.locked) {
        if (isPlatformAdminProfile(profile)) {
          await logPlatformAudit(db, {
            actor: profile,
            action: AUDIT_ACTIONS.LOGIN_LOCKED,
            meta: { ip, locked_until: failResult.lockedUntil },
          })
        }
        return err('Too many attempts. Try again later.', 429)
      }
      return err('Invalid credentials', 401)
    }

    if (!await verifyPassword(b.password, profile.password_hash)) {
      const failResult = await recordLoginFailure(db, email, ip)
      if (isPlatformAdminProfile(profile)) {
        await logPlatformAudit(db, {
          actor: profile,
          action: AUDIT_ACTIONS.LOGIN_PASSWORD_FAILED,
          meta: { ip },
        })
      }
      if (failResult.locked) {
        if (isPlatformAdminProfile(profile)) {
          await logPlatformAudit(db, {
            actor: profile,
            action: AUDIT_ACTIONS.LOGIN_LOCKED,
            meta: { ip, locked_until: failResult.lockedUntil },
          })
        }
        return err('Too many attempts. Try again later.', 429)
      }
      return err('Invalid credentials', 401)
    }

    if (requiresEmailVerification(profile)) {
      return err('Please verify your email before logging in. Check your inbox for the verification link.', 403)
    }

    await clearLoginRateLimit(db, email, ip)

    if (isPlatformAdminProfile(profile)) {
      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.LOGIN_PASSWORD_SUCCESS,
        meta: { ip },
      })
      return json({
        ok: true,
        is_platform_admin: true,
        requires_platform_2fa: true,
        setup_required: !profile.totp_enabled,
        pending_token: issuePendingToken(profile.id),
      })
    }

    const c = await db.collection('clinics').findOne({ id: profile.clinic_id })
    const roles = await ensureProfileRolesMigrated(db, profile)
    await db.collection('profiles').updateOne({ id: profile.id }, { $set: { last_login_at: new Date() } })
    setAuthCookie(signToken({ uid: profile.id, cid: profile.clinic_id, roles, role: roles[0] || profile.role }))
    return json({ ok: true, onboarding_complete: !!c?.onboarding_complete })
  } catch (e) {
    console.error('Auth login error:', e)
    const debugData = {
      errorName: e?.name || 'Error',
      errorCode: e?.code || null,
      mongo: getMongoEnvHint(),
    }
    // #region agent log
    fetch('http://127.0.0.1:7366/ingest/f3641e0b-1a49-4955-8e0b-16987fcc4471',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'87f42d'},body:JSON.stringify({sessionId:'87f42d',location:'app/api/auth/login/route.js:POST:catch',message:'login POST failed',data:debugData,timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return loginErrorResponse('Internal server error', 500, debugData)
  }
}
