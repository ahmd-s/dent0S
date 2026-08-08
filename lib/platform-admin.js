import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

export const PLATFORM_STATUS = ['active', 'comped', 'locked', 'force_active', 'force_trial']

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
  TRIAL_DATE_CHANGED: 'trial_date_changed',
  LIFECYCLE_STATUS_CHANGED: 'lifecycle_status_changed',
  EMERGENCY_LOCK: 'emergency_lock',
  EMERGENCY_UNLOCK: 'emergency_unlock',
  FEATURE_FLAGS_CHANGED: 'feature_flags_changed',
  PAYMENT_RECOVERED: 'payment_recovered',
  PAYMENT_FAILED_GRACE_STARTED: 'payment_failed_grace_started',
  GRACE_EXPIRED_AUTO_BLOCKED: 'grace_expired_auto_blocked',
  SUBSCRIPTION_REASON_CHANGED: 'subscription_reason_changed',
  // Sprint 4
  CLINIC_IMPERSONATED: 'clinic_impersonated',
  IMPERSONATION_EXITED: 'impersonation_exited',
  BROADCAST_SENT: 'broadcast_sent',
  MAINTENANCE_ENABLED: 'maintenance_enabled',
  MAINTENANCE_DISABLED: 'maintenance_disabled',
  SUPPORT_NOTE_ADDED: 'support_note_added',
  SUPPORT_METADATA_UPDATED: 'support_metadata_updated',
  SECURITY_FORCE_LOGOUT: 'security_force_logout',
  SECURITY_LOGIN_DISABLED: 'security_login_disabled',
  SECURITY_LOGIN_ENABLED: 'security_login_enabled',
  SETTINGS_UPDATED: 'settings_updated',
}

/** Canonical reasons stored on subscriptions.subscription_reason */
export const SUBSCRIPTION_REASONS = [
  'trial_started',
  'trial_expired',
  'payment_failed',
  'payment_recovered',
  'manual_override',
  'manual_payment',
  'emergency_lock',
  'admin_lock',
  'cancelled',
  'grace_started',
  'grace_expired',
]

export const CLINIC_ACCESS_STATUS = ['active', 'blocked']

export const LIFECYCLE_STATUSES = ['trial', 'active', 'grace', 'paused', 'blocked', 'cancelled', 'comped', 'locked']

export const DEFAULT_FEATURES = {
  // Core
  appointments: true,
  billing: true,
  inventory: true,
  labs: true,
  reports: true,
  booking: true,
  // AI & advanced
  ai: true,
  analytics: false,
  xray_ai: false,
  voice: false,
  // Communication
  whatsapp: false,
  sms: false,
  email_notifications: true,
  // Portals
  patient_portal: false,
  doctor_portal: false,
  reception_portal: false,
  // Access & storage
  api_access: false,
  uploads: true,
}

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
