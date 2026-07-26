import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

export const PLATFORM_STATUS = ['active', 'comped', 'locked']

export const AUDIT_ACTIONS = {
  LOGIN_PASSWORD_SUCCESS: 'login_password_success',
  LOGIN_PASSWORD_FAILED: 'login_password_failed',
  LOGIN_TOTP_SUCCESS: 'login_totp_success',
  LOGIN_TOTP_FAILED: 'login_totp_failed',
  LOGIN_LOCKED: 'login_locked',
  TOTP_SETUP_COMPLETED: 'totp_setup_completed',
  SUBSCRIPTION_STATUS_CHANGED: 'subscription_status_changed',
  CLINIC_ACCESS_STATUS_CHANGED: 'clinic_access_status_changed',
  AI_USAGE_LIMIT_CHANGED: 'ai_usage_limit_changed',
  MANUAL_PAYMENT_RECORDED: 'manual_payment_recorded',
  TRIAL_EXPIRED_AUTO_BLOCKED: 'trial_expired_auto_blocked',
  TRIAL_AUTO_ENFORCEMENT_CHANGED: 'trial_auto_enforcement_changed',
}

export const CLINIC_ACCESS_STATUS = ['active', 'blocked']

export function isPlatformAdminProfile(profile) {
  if (!profile) return false
  if (profile.is_platform_admin === true) return true
  // Platform admin is the only profile type without a clinic assignment
  return profile.clinic_id == null
}

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function requirePlatformAdmin() {
  const t = getCurrentUser()
  if (!t?.pa) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile || !isPlatformAdminProfile(profile)) return null
  return { profile, db }
}

export async function logPlatformAudit(db, {
  actor,
  action,
  targetClinicId = null,
  targetClinicName = null,
  meta = {},
}) {
  try {
    await db.collection('platform_admin_audit_logs').insertOne({
      id: uuidv4(),
      actor_id: actor?.id || null,
      actor_email: actor?.email || '',
      action,
      target_clinic_id: targetClinicId,
      target_clinic_name: targetClinicName,
      meta: meta || {},
      at: new Date(),
    })
  } catch (e) {
    console.error('Platform audit log error:', e)
  }
}

export function notFound() {
  return Response.json({ error: 'Not found' }, { status: 404 })
}
