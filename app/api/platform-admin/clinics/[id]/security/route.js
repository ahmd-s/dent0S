import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

    const [profiles, impersonationHistory, rateLimits] = await Promise.all([
      db.collection('profiles')
        .find({ clinic_id: params.id, deleted_at: { $exists: false } })
        .sort({ created_at: 1 })
        .toArray(),

      db.collection('platform_admin_audit_logs')
        .find({
          target_clinic_id: params.id,
          action: { $in: ['clinic_impersonated', 'impersonation_exited'] },
        })
        .sort({ at: -1 })
        .limit(20)
        .toArray(),

      // Rate limits (failed logins) for clinic users
      db.collection('login_rate_limits')
        .find({ email: { $in: [] } }) // enriched below
        .toArray()
        .catch(() => []),
    ])

    // Get rate limits for clinic user emails
    const emails = profiles.map(p => p.email)
    const failedLogins = emails.length
      ? await db.collection('login_rate_limits')
          .find({ email: { $in: emails } })
          .toArray()
          .catch(() => [])
      : []

    const failedMap = Object.fromEntries(failedLogins.map(r => [r.email, r]))

    const staff = profiles.map(p => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: p.role,
      roles: p.roles || [p.role],
      is_active: p.is_active !== false,
      email_verified: !!p.email_verified,
      has_google: !!p.google_sub,
      has_2fa: !!(p.totp_secret_enc),
      last_login_at: p.last_login_at || null,
      force_logout_at: p.force_logout_at || null,
      failed_attempts: failedMap[p.email]?.count || 0,
      created_at: p.created_at,
    }))

    return json({
      staff,
      impersonation_history: impersonationHistory.map(({ _id, ...rest }) => rest),
      clinic_emergency_locked: !!clinic.emergency_locked_at,
      clinic_blocked: clinic.subscription_status === 'blocked',
    })
  } catch (e) {
    console.error('Security GET error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
