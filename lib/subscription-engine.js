/**
 * lib/subscription-engine.js
 *
 * The single source of truth for all subscription lifecycle mutations in DentOS.
 *
 * Every state change that touches clinics.subscription_status, clinics.trial_ends_at,
 * clinics.features, subscriptions.subscription_status, subscriptions.platform_status
 * or subscriptions.grace_period_end MUST go through this module.
 *
 * Design rules:
 *   - Functions accept (db, actor, clinicId, opts) or (db, clinicId, opts) for system ops.
 *   - actor = { id, email } for human actions; use SYSTEM_ACTOR for automated processes.
 *   - Every function returns { ok: true, state: SubscriptionState } or { ok: false, error }.
 *   - Audit logs are created here — callers must not duplicate them.
 *   - No HTTP, no auth, no Razorpay API calls belong here.
 */

import { v4 as uuidv4 } from 'uuid'
import { isActivePaidSubscription } from '@/lib/subscription-helpers'
import {
  AUDIT_ACTIONS,
  DEFAULT_FEATURES,
  LIFECYCLE_STATUSES,
  PLATFORM_STATUS,
  SUBSCRIPTION_REASONS,
  logPlatformAudit,
} from '@/lib/platform-admin'
import { createPlatformNotification, createPlatformNotificationOnce } from '@/lib/platform-notifications'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Actor token for automated processes (cron, webhooks). */
export const SYSTEM_ACTOR = { id: null, email: 'system' }

/**
 * Lifecycle status → DB field mapping.
 * null in sub fields means "clear / $unset".
 */
const TRANSITIONS = {
  trial:     { clinic: { subscription_status: 'active' }, sub: { subscription_status: 'trial', platform_status: null } },
  active:    { clinic: { subscription_status: 'active' }, sub: { subscription_status: 'active', platform_status: null } },
  grace:     { clinic: { subscription_status: 'active' }, sub: { subscription_status: 'halted', platform_status: null } },
  paused:    { clinic: { subscription_status: 'blocked' }, sub: {} },
  blocked:   { clinic: { subscription_status: 'blocked' }, sub: {} },
  cancelled: { clinic: { subscription_status: 'active' }, sub: { subscription_status: 'cancelled', platform_status: null } },
  comped:    { clinic: { subscription_status: 'active' }, sub: { platform_status: 'comped' } },
  locked:    { clinic: { subscription_status: 'blocked' }, sub: { platform_status: 'locked' } },
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _readDocs(db, clinicId) {
  const [clinic, sub] = await Promise.all([
    db.collection('clinics').findOne({ id: clinicId }),
    db.collection('subscriptions').findOne({ clinic_id: clinicId }),
  ])
  return { clinic, sub }
}

function _normalizeAccessStatus(clinic) {
  return clinic?.subscription_status === 'blocked' ? 'blocked' : 'active'
}

function _buildState(clinic, sub) {
  const clinicStatus = _normalizeAccessStatus(clinic)
  const billingStatus = sub?.subscription_status || null
  const platformStatus = sub?.platform_status ?? null
  const isBlocked = clinicStatus === 'blocked'
  const isTrial = billingStatus === 'trial'
  const isGrace = billingStatus === 'halted'
  const isPaid = isActivePaidSubscription(sub)

  return {
    clinicStatus,
    billingStatus,
    platformStatus,
    trialEndsAt: clinic?.trial_ends_at || null,
    graceEndsAt: sub?.grace_period_end || null,
    currentPeriodEnd: sub?.current_period_end || null,
    override: platformStatus,
    isBlocked,
    isTrial,
    isGrace,
    isPaid,
    // Extended fields used by route handlers
    trialAutoEnforcement: clinic?.trial_auto_enforcement || 'auto',
    monthlyAiUsageLimit: clinic?.monthly_ai_usage_limit ?? null,
    features: clinic?.features || DEFAULT_FEATURES,
    emergencyLockedAt: clinic?.emergency_locked_at || null,
    emergencyLockedBy: clinic?.emergency_locked_by || null,
    emergencyLockedReason: clinic?.emergency_locked_reason || null,
    planType: sub?.plan_type || null,
    subscriptionId: sub?.razorpay_subscription_id || sub?.subscription_id || null,
    customerId: sub?.razorpay_customer_id || sub?.customer_id || null,
    paymentMethod: sub?.payment_method || null,
    manualAccessGrantedAt: clinic?.manual_access_granted_at || null,
    subscriptionReason: sub?.subscription_reason || null,
  }
}

async function _audit(db, actor, action, clinicId, clinicName, meta = {}) {
  await logPlatformAudit(db, { actor, action, targetClinicId: clinicId, targetClinicName: clinicName, meta })
}

async function _writeClinic(db, clinicId, $set) {
  await db.collection('clinics').updateOne({ id: clinicId }, { $set })
}

async function _writeSub(db, clinicId, $set = {}, $unset = {}) {
  const op = {}
  const setWithTs = { ...$set, updated_at: new Date() }
  if (Object.keys(setWithTs).length > 1 || Object.keys($set).length) op.$set = setWithTs
  if (Object.keys($unset).length) op.$unset = $unset
  if (Object.keys(op).length) {
    await db.collection('subscriptions').updateOne({ clinic_id: clinicId }, op, { upsert: true })
  }
}

async function _setSubscriptionReason(db, clinicId, reason) {
  if (!reason || !SUBSCRIPTION_REASONS.includes(reason)) return
  await _writeSub(db, clinicId, { subscription_reason: reason })
}

function _lifecycleReasonForStatus(status, explicitReason) {
  if (explicitReason && SUBSCRIPTION_REASONS.includes(explicitReason)) return explicitReason
  const map = {
    trial: 'manual_override',
    active: 'manual_override',
    grace: 'grace_started',
    paused: 'admin_lock',
    blocked: 'admin_lock',
    cancelled: 'cancelled',
    comped: 'manual_override',
    locked: 'admin_lock',
  }
  return map[status] || 'manual_override'
}

// ── State reader ──────────────────────────────────────────────────────────────

/**
 * Read the current subscription state for a clinic without making any writes.
 * Returns null if the clinic does not exist.
 */
export async function readState(db, clinicId) {
  const { clinic, sub } = await _readDocs(db, clinicId)
  if (!clinic) return null
  return _buildState(clinic, sub)
}

/** Alias — use when you need to query current state explicitly (e.g. after an operation). */
export const syncSubscriptionState = readState

// ── Trial ─────────────────────────────────────────────────────────────────────

/**
 * Bootstrap a new subscription document in trial state.
 * Called from signup and create-clinic-owner. The clinic document must already exist.
 */
export async function createTrial(db, clinicId, { trialEnd, createdAt }) {
  const now = createdAt || new Date()
  await db.collection('subscriptions').updateOne(
    { clinic_id: clinicId },
    {
      $set: {
        subscription_status: 'trial',
        plan_type: null,
        trial_start: now,
        trial_end: trialEnd,
        razorpay_subscription_id: null,
        razorpay_plan_id: null,
        razorpay_customer_id: null,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        cancelled_at: null,
        grace_period_end: null,
        subscription_reason: 'trial_started',
        last_payment_date: null,
        last_payment_amount: null,
        updated_at: now,
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true }
  )
}

/**
 * Extend the trial by a number of days relative to the current trial_ends_at (or today).
 */
export async function extendTrial(db, actor, clinicId, { days }) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const base = clinic.trial_ends_at ? new Date(clinic.trial_ends_at) : new Date()
  base.setDate(base.getDate() + days)
  return setTrialEndDate(db, actor, clinicId, { date: base })
}

/**
 * Set an exact trial end date. Pass null to clear.
 */
export async function setTrialEndDate(db, actor, clinicId, { date }) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  let nextDate = null
  if (date !== null && date !== undefined && date !== '') {
    nextDate = new Date(date)
    if (Number.isNaN(nextDate.getTime())) return { ok: false, error: 'Invalid date' }
  }
  const nextIso = nextDate ? nextDate.toISOString() : null
  const prevIso = clinic.trial_ends_at ? new Date(clinic.trial_ends_at).toISOString() : null

  if (prevIso === nextIso) {
    const state = _buildState(clinic, await db.collection('subscriptions').findOne({ clinic_id: clinicId }))
    return { ok: true, state }
  }

  await _writeClinic(db, clinicId, { trial_ends_at: nextDate, updated_at: new Date() })

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.TRIAL_DATE_CHANGED, clinicId, clinic.name, {
      from: prevIso,
      to: nextIso,
    })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

/**
 * Set trial auto-enforcement ('auto' | 'paused').
 */
export async function setTrialEnforcement(db, actor, clinicId, { enforcement }) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const from = clinic.trial_auto_enforcement || 'auto'
  if (from === enforcement) {
    const sub = await db.collection('subscriptions').findOne({ clinic_id: clinicId })
    return { ok: true, state: _buildState(clinic, sub) }
  }

  const $set = { trial_auto_enforcement: enforcement, updated_at: new Date() }
  if (enforcement === 'paused' && !clinic.manual_access_granted_at) {
    $set.manual_access_granted_at = new Date()
  }
  if (enforcement === 'auto') {
    $set.manual_access_granted_at = null
  }
  await _writeClinic(db, clinicId, $set)

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.TRIAL_AUTO_ENFORCEMENT_CHANGED, clinicId, clinic.name, {
      from,
      to: enforcement,
    })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

// ── Paid activation ───────────────────────────────────────────────────────────

/**
 * Activate a paid subscription after a successful Razorpay charge or manual registration.
 * Updates both the subscriptions doc and the clinic access gate.
 * Does NOT generate a platform audit log (Razorpay events are not platform-admin actions).
 */
export async function activateSubscription(db, clinicId, {
  periodEnd,
  periodStart = null,
  planType = null,
  lastPaymentDate = null,
  razorpaySubId = null,
  razorpayPlanId = null,
  clearGrace = true,
  reason = 'payment_recovered',
  clearEmergencyLock = true,
} = {}) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const now = new Date()
  const subSet = {
    subscription_status: 'active',
    subscription_reason: SUBSCRIPTION_REASONS.includes(reason) ? reason : 'payment_recovered',
    current_period_end: periodEnd,
    last_payment_date: lastPaymentDate || now,
    updated_at: now,
  }
  if (clearGrace) subSet.grace_period_end = null
  if (periodStart) subSet.current_period_start = periodStart
  if (planType) subSet.plan_type = planType
  if (razorpaySubId) subSet.razorpay_subscription_id = razorpaySubId
  if (razorpayPlanId) subSet.razorpay_plan_id = razorpayPlanId
  if (razorpaySubId) subSet.cancel_at_period_end = false

  await db.collection('subscriptions').updateOne({ clinic_id: clinicId }, { $set: subSet }, { upsert: true })

  const clinicSet = {
    subscription_status: 'active',
    trial_auto_enforcement: 'auto',
    updated_at: now,
  }
  if (clearEmergencyLock) {
    clinicSet.emergency_locked_at = null
    clinicSet.emergency_locked_by = null
    clinicSet.emergency_locked_reason = null
  }
  await _writeClinic(db, clinicId, clinicSet)

  await _audit(db, SYSTEM_ACTOR, AUDIT_ACTIONS.PAYMENT_RECOVERED, clinicId, clinic.name, {
    reason: subSet.subscription_reason,
    period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
    automated: true,
  })

  await createPlatformNotification(db, {
    type: 'payment_recovered',
    clinicId,
    clinicName: clinic.name,
    meta: { reason: subSet.subscription_reason },
  })

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

// ── Grace & cancellation ──────────────────────────────────────────────────────

/**
 * Put a subscription into grace period (Razorpay subscription.failed event).
 */
export async function startGracePeriod(db, clinicId, { graceEnd, reason = 'payment_failed' } = {}) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const subReason = SUBSCRIPTION_REASONS.includes(reason) ? reason : 'payment_failed'
  await _writeSub(db, clinicId, {
    subscription_status: 'halted',
    grace_period_end: graceEnd,
    subscription_reason: subReason,
  })

  await _audit(db, SYSTEM_ACTOR, AUDIT_ACTIONS.PAYMENT_FAILED_GRACE_STARTED, clinicId, clinic.name, {
    reason: subReason,
    grace_period_end: graceEnd ? new Date(graceEnd).toISOString() : null,
    automated: true,
  })

  await createPlatformNotification(db, {
    type: 'grace_started',
    clinicId,
    clinicName: clinic.name,
    meta: { grace_period_end: graceEnd ? new Date(graceEnd).toISOString() : null },
  })

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

/**
 * Mark a subscription as cancelled (Razorpay subscription.cancelled event or manual).
 */
export async function cancelSubscription(db, actor, clinicId) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  await _writeSub(db, clinicId, { subscription_status: 'cancelled', cancelled_at: new Date(), subscription_reason: 'cancelled' })
  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

// ── Block / unblock ───────────────────────────────────────────────────────────

/**
 * Block clinic access gate via an explicit admin action (toggle or lifecycle).
 * Also re-enables trial auto-enforcement.
 */
export async function blockClinic(db, actor, clinicId, { from = null, subscriptionReason = null } = {}) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const currentStatus = _normalizeAccessStatus(clinic)
  if (currentStatus === 'blocked') {
    const sub = await db.collection('subscriptions').findOne({ clinic_id: clinicId })
    return { ok: true, state: _buildState(clinic, sub) }
  }

  await _writeClinic(db, clinicId, {
    subscription_status: 'blocked',
    trial_auto_enforcement: 'auto',
    updated_at: new Date(),
  })

  if (subscriptionReason) {
    await _setSubscriptionReason(db, clinicId, subscriptionReason)
  } else if (actor && actor.email !== SYSTEM_ACTOR.email) {
    await _setSubscriptionReason(db, clinicId, 'admin_lock')
  }

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.CLINIC_ACCESS_STATUS_CHANGED, clinicId, clinic.name, {
      from: from || currentStatus,
      to: 'blocked',
      ...(subscriptionReason ? { subscription_reason: subscriptionReason } : {}),
    })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

/**
 * Used by the trial-expiry cron only. Does NOT set trial_auto_enforcement (cron already
 * filters auto-paused clinics) and uses a distinct audit action.
 */
export async function blockExpiredTrial(db, clinicId) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  await _writeClinic(db, clinicId, { subscription_status: 'blocked', updated_at: new Date() })
  await _setSubscriptionReason(db, clinicId, 'trial_expired')

  await _audit(db, SYSTEM_ACTOR, AUDIT_ACTIONS.TRIAL_EXPIRED_AUTO_BLOCKED, clinicId, clinic.name, {
    from: 'active',
    to: 'blocked',
    automated: true,
    reason: 'trial_expired',
  })

  await createPlatformNotification(db, {
    type: 'clinic_blocked',
    clinicId,
    clinicName: clinic.name,
    meta: { reason: 'trial_expired' },
  })

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

/**
 * Block clinic access when grace period expires without payment recovery.
 * Delegates to blockClinic — cron must not duplicate blocking logic.
 */
export async function blockGraceExpired(db, clinicId) {
  const { clinic, sub } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const result = await blockClinic(db, SYSTEM_ACTOR, clinicId, {
    from: 'active',
    subscriptionReason: 'grace_expired',
  })
  if (!result.ok) return result

  await _audit(db, SYSTEM_ACTOR, AUDIT_ACTIONS.GRACE_EXPIRED_AUTO_BLOCKED, clinicId, clinic.name, {
    from: 'active',
    to: 'blocked',
    automated: true,
    reason: 'grace_expired',
    grace_period_end: sub?.grace_period_end ? new Date(sub.grace_period_end).toISOString() : null,
  })

  await createPlatformNotification(db, {
    type: 'clinic_blocked',
    clinicId,
    clinicName: clinic.name,
    meta: { reason: 'grace_expired' },
  })

  return result
}

/**
 * Unblock clinic access gate. Pauses trial auto-enforcement so cron does not
 * immediately re-block. Clears any emergency lock metadata.
 */
export async function unblockClinic(db, actor, clinicId, { from = 'blocked' } = {}) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const currentStatus = _normalizeAccessStatus(clinic)
  if (currentStatus !== 'blocked') {
    const sub = await db.collection('subscriptions').findOne({ clinic_id: clinicId })
    return { ok: true, state: _buildState(clinic, sub) }
  }

  const $set = {
    subscription_status: 'active',
    trial_auto_enforcement: 'paused',
    manual_access_granted_at: new Date(),
    updated_at: new Date(),
  }
  // Always clear emergency lock fields on unblock
  $set.emergency_locked_at = null
  $set.emergency_locked_by = null
  $set.emergency_locked_reason = null

  await _writeClinic(db, clinicId, $set)

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.CLINIC_ACCESS_STATUS_CHANGED, clinicId, clinic.name, {
      from,
      to: 'active',
      trial_auto_enforcement: 'paused',
    })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

/**
 * Block clinic access in a "paused" context (lifecycle action — not emergency, not cron).
 * Semantically identical to blockClinic but uses LIFECYCLE_STATUS_CHANGED in the audit trail.
 */
export async function pauseSubscription(db, actor, clinicId, { reason = null } = {}) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const currentStatus = _normalizeAccessStatus(clinic)
  await _writeClinic(db, clinicId, {
    subscription_status: 'blocked',
    trial_auto_enforcement: 'auto',
    updated_at: new Date(),
  })

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.LIFECYCLE_STATUS_CHANGED, clinicId, clinic.name, {
      to: 'paused',
      clinic_subscription_status: 'blocked',
      from: currentStatus,
      reason,
    })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

// ── Platform overrides ────────────────────────────────────────────────────────

/**
 * Set (or clear) the platform_status override on the subscriptions document.
 * pass null to remove the override.
 */
export async function setPlatformOverride(db, actor, clinicId, { platformStatus }) {
  const { clinic, sub } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const nextStatus = platformStatus === '' ? null : platformStatus
  if (nextStatus !== null && !PLATFORM_STATUS.includes(nextStatus)) {
    return { ok: false, error: `Invalid platform_status. Allowed: ${PLATFORM_STATUS.join(', ')}` }
  }

  const from = sub?.platform_status ?? null
  if (nextStatus !== null) {
    await _writeSub(db, clinicId, { platform_status: nextStatus })
  } else {
    // Clear the field
    await db.collection('subscriptions').updateOne(
      { clinic_id: clinicId },
      { $unset: { platform_status: '' }, $set: { updated_at: new Date() } },
      { upsert: true }
    )
  }

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.SUBSCRIPTION_STATUS_CHANGED, clinicId, clinic.name, {
      from,
      to: nextStatus,
    })
  }

  const { clinic: updated, sub: updatedSub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, updatedSub) }
}

export const compClinic = (db, actor, clinicId) =>
  applyLifecycle(db, actor, clinicId, { status: 'comped' })

export const lockClinic = (db, actor, clinicId) =>
  applyLifecycle(db, actor, clinicId, { status: 'locked' })

export const forceTrial = (db, actor, clinicId) =>
  setPlatformOverride(db, actor, clinicId, { platformStatus: 'force_trial' })

export const forceActive = (db, actor, clinicId) =>
  setPlatformOverride(db, actor, clinicId, { platformStatus: 'force_active' })

// ── Emergency ─────────────────────────────────────────────────────────────────

/**
 * Apply an emergency lock: blocks all clinic staff immediately.
 * Requires a non-empty reason which is permanently recorded.
 */
export async function emergencyLock(db, actor, clinicId, { reason }) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }
  if (!reason?.trim()) return { ok: false, error: 'A reason is required for emergency lock' }

  const now = new Date()
  await _writeClinic(db, clinicId, {
    subscription_status: 'blocked',
    trial_auto_enforcement: 'auto',
    emergency_locked_at: now,
    emergency_locked_by: actor?.email || '',
    emergency_locked_reason: reason.trim(),
    updated_at: now,
  })
  await _setSubscriptionReason(db, clinicId, 'emergency_lock')

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.EMERGENCY_LOCK, clinicId, clinic.name, {
      reason: reason.trim(),
      by: actor.email || '',
    })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

/**
 * Remove an emergency lock and restore clinic access.
 */
export async function emergencyUnlock(db, actor, clinicId) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const now = new Date()
  await _writeClinic(db, clinicId, {
    subscription_status: 'active',
    trial_auto_enforcement: 'paused',
    manual_access_granted_at: now,
    emergency_locked_at: null,
    emergency_locked_by: null,
    emergency_locked_reason: null,
    updated_at: now,
  })

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.EMERGENCY_UNLOCK, clinicId, clinic.name, {
      by: actor?.email || '',
    })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

// ── Feature flags ─────────────────────────────────────────────────────────────

/**
 * Update clinic feature flags. Unknown keys are ignored; missing keys default to true.
 */
export async function updateFeatureFlags(db, actor, clinicId, { features }) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }
  if (typeof features !== 'object' || features === null) return { ok: false, error: 'features must be an object' }

  const allowed = Object.keys(DEFAULT_FEATURES)
  const next = {}
  for (const k of allowed) {
    next[k] = features[k] !== undefined ? Boolean(features[k]) : true
  }

  const prev = clinic.features || DEFAULT_FEATURES
  const changed = allowed.filter(k => prev[k] !== next[k])
  if (changed.length === 0) {
    const sub = await db.collection('subscriptions').findOne({ clinic_id: clinicId })
    return { ok: true, state: _buildState(clinic, sub) }
  }

  await _writeClinic(db, clinicId, { features: next, updated_at: new Date() })

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.FEATURE_FLAGS_CHANGED, clinicId, clinic.name, {
      changed: changed.reduce((acc, k) => ({ ...acc, [k]: { from: prev[k], to: next[k] } }), {}),
    })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

// ── AI limits ─────────────────────────────────────────────────────────────────

/**
 * Set the monthly AI usage limit. Pass null to remove the limit.
 */
export async function setAiLimit(db, actor, clinicId, { limit }) {
  const { clinic } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  let next = limit
  if (next === null || next === '' || next === undefined) {
    next = null
  } else {
    next = Number(next)
    if (!Number.isFinite(next) || next < 0) return { ok: false, error: 'Invalid monthly_ai_usage_limit' }
  }

  const from = clinic.monthly_ai_usage_limit ?? null
  if (from === next) {
    const sub = await db.collection('subscriptions').findOne({ clinic_id: clinicId })
    return { ok: true, state: _buildState(clinic, sub) }
  }

  await _writeClinic(db, clinicId, { monthly_ai_usage_limit: next, updated_at: new Date() })

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.AI_USAGE_LIMIT_CHANGED, clinicId, clinic.name, { from, to: next })
  }

  const { clinic: updated, sub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, sub) }
}

// ── Manual payments ───────────────────────────────────────────────────────────

/**
 * Record a manual payment entry and write the audit log.
 * Returns { ok, payment } (not the standard state object).
 */
export async function recordManualPayment(db, actor, clinicId, { date, amount, method, note }) {
  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  if (!date || amount == null || amount === '' || !String(method || '').trim()) {
    return { ok: false, error: 'date, amount, and method are required' }
  }
  const parsedAmount = Number(amount)
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return { ok: false, error: 'Invalid amount' }

  const now = new Date()
  const entry = {
    id: uuidv4(),
    clinic_id: clinicId,
    date,
    amount: parsedAmount,
    method: String(method).trim(),
    note: note ? String(note).trim() : '',
    recorded_by_id: actor?.id || null,
    recorded_by_email: actor?.email || '',
    recorded_at: now,
  }

  await db.collection('clinic_manual_payments').insertOne(entry)

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.MANUAL_PAYMENT_RECORDED, clinicId, clinic.name, {
      amount: entry.amount,
      method: entry.method,
      date: entry.date,
      note: entry.note || null,
    })
  }

  // Return without _id
  const { _id, ...clean } = entry
  void _id
  return { ok: true, payment: clean }
}

// ── Full lifecycle transition ─────────────────────────────────────────────────

/**
 * Apply a named lifecycle status transition.
 * This is the authoritative implementation of the TRANSITIONS table used by the
 * Platform Admin lifecycle endpoint.
 *
 * Validation:
 *   - Cannot set 'active' billing when billingStatus === 'cancelled' unless { force: true }
 *   - Cannot start grace period when clinic is already blocked
 *   - Cannot extend trial for comped clinic unless { force: true }
 */
export async function applyLifecycle(db, actor, clinicId, { status, reason = null, force = false }) {
  if (!status || !LIFECYCLE_STATUSES.includes(status)) {
    return { ok: false, error: `status must be one of: ${LIFECYCLE_STATUSES.join(', ')}` }
  }

  const { clinic, sub } = await _readDocs(db, clinicId)
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  // ── Validation ───────────────────────────────────────────────────────────
  if (!force) {
    const billingStatus = sub?.subscription_status || null
    const clinicStatus = _normalizeAccessStatus(clinic)
    const platformStatus = sub?.platform_status ?? null

    if (status === 'active' && billingStatus === 'cancelled') {
      return {
        ok: false,
        error: 'Cannot set active on a cancelled subscription. Pass force:true to override.',
        code: 'INVALID_TRANSITION',
      }
    }
    if (status === 'grace' && clinicStatus === 'blocked') {
      return {
        ok: false,
        error: 'Cannot start grace period for a blocked clinic.',
        code: 'INVALID_TRANSITION',
      }
    }
    if ((status === 'trial') && (platformStatus === 'comped' || platformStatus === 'locked')) {
      return {
        ok: false,
        error: 'Cannot reset to trial while a platform override is active. Remove the override first or pass force:true.',
        code: 'INVALID_TRANSITION',
      }
    }
  }

  const tx = TRANSITIONS[status]
  const now = new Date()

  // ── Clinic writes ─────────────────────────────────────────────────────────
  const clinicSet = { ...tx.clinic, updated_at: now }
  const currentlyBlocked = clinic.subscription_status === 'blocked'
  const willBeActive = tx.clinic.subscription_status === 'active'
  const willBeBlocked = tx.clinic.subscription_status === 'blocked'

  if (currentlyBlocked && willBeActive) {
    clinicSet.trial_auto_enforcement = 'paused'
    clinicSet.manual_access_granted_at = now
  }
  if (!currentlyBlocked && willBeBlocked) {
    clinicSet.trial_auto_enforcement = 'auto'
  }
  if (willBeActive && clinic.emergency_locked_at) {
    clinicSet.emergency_locked_at = null
    clinicSet.emergency_locked_by = null
    clinicSet.emergency_locked_reason = null
  }

  await _writeClinic(db, clinicId, clinicSet)

  // ── Subscription writes ───────────────────────────────────────────────────
  if (Object.keys(tx.sub).length > 0) {
    const subSetRaw = { ...tx.sub }
    const $subSet = { updated_at: now }
    const $subUnset = {}

    for (const [k, v] of Object.entries(subSetRaw)) {
      if (v === null) $subUnset[k] = ''
      else $subSet[k] = v
    }

    $subSet.subscription_reason = _lifecycleReasonForStatus(status, reason)

    const updateOp = {}
    if (Object.keys($subSet).length > 1) updateOp.$set = $subSet
    if (Object.keys($subUnset).length > 0) updateOp.$unset = $subUnset
    if (Object.keys(updateOp).length > 0) {
      await db.collection('subscriptions').updateOne({ clinic_id: clinicId }, updateOp, { upsert: true })
    }
  } else {
    await _setSubscriptionReason(db, clinicId, _lifecycleReasonForStatus(status, reason))
  }

  if (actor) {
    await _audit(db, actor, AUDIT_ACTIONS.LIFECYCLE_STATUS_CHANGED, clinicId, clinic.name, {
      to: status,
      reason: reason ? String(reason).trim() : null,
      clinic_subscription_status: tx.clinic.subscription_status,
      ...(tx.sub.subscription_status !== undefined ? { billing_status: tx.sub.subscription_status } : {}),
      ...(tx.sub.platform_status !== undefined ? { platform_status: tx.sub.platform_status } : {}),
    })
  }

  const { clinic: updated, sub: updatedSub } = await _readDocs(db, clinicId)
  return { ok: true, state: _buildState(updated, updatedSub) }
}
