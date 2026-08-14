import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser, getCurrentImpersonatedUser } from '@/lib/auth'
import { loadUserContext } from '@/lib/auth-context'
import { isPlatformAdminProfile } from '@/lib/platform-admin'
import { ensureProfileRolesMigrated } from '@/lib/profile-roles'
import { shouldShowTrialWarning, trialDaysRemaining } from '@/lib/subscription-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

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
  // Impersonation session takes precedence for clinic-scoped API access
  const imp = getCurrentImpersonatedUser()
  if (imp?.imp) {
    const db = await getDb()
    return loadUserContext(db, imp.uid, { token: imp, isImpersonated: true })
  }
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const ctx = await loadUserContext(db, t.uid, { token: t })
  if (!ctx) return null
  // Platform admins are not scoped to a clinic even if the profile carries one.
  if (isPlatformAdminProfile(ctx.profile)) return { ...ctx, clinic: null }
  return ctx
}

export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    const isPA = isPlatformAdminProfile(ctx.profile)
    if (!isPA && ctx.profile?.clinic_id) {
      await ensureProfileRolesMigrated(ctx.db, ctx.profile)
      ctx.profile = await ctx.db.collection('profiles').findOne({ id: ctx.profile.id })
    }

    let subscription_hint = null
    if (!isPA && ctx.clinic) {
      const sub = await ctx.db.collection('subscriptions').findOne({ clinic_id: ctx.clinic.id })
      const days = trialDaysRemaining(ctx.clinic, sub)
      subscription_hint = {
        trial_days_remaining: days,
        show_trial_warning: shouldShowTrialWarning(ctx.clinic, sub),
      }
    }

    return json({
      user: { id: ctx.profile.id, email: ctx.profile.email },
      profile: clean(ctx.profile),
      clinic: clean(ctx.clinic),
      subscription_hint,
      is_platform_admin: isPA,
      platform_session_active: isPA && !!ctx.token?.pa,
      is_impersonating: ctx.isImpersonated === true,
      impersonated_by_email: ctx.isImpersonated ? ctx.token?.imp_by_email : null,
      impersonated_clinic_name: ctx.isImpersonated ? ctx.token?.imp_clinic_name : null,
    })
  } catch (e) {
    console.error('Auth me error:', e)
    return err('Internal server error', 500)
  }
}
