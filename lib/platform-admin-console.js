/**
 * Super Admin console service — Mongo-backed operations.
 * Pure helpers live in platform-admin-console-core.js.
 */

import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_FEATURES } from '@/lib/default-features'
import {
  AUDIT_ACTIONS,
  logPlatformAudit,
} from '@/lib/platform-admin'
import {
  activateSubscription,
  applyLifecycle,
  blockClinic,
  pauseSubscription,
  recordManualPayment,
  setTrialEndDate,
  unblockClinic,
} from '@/lib/subscription-engine'
import { isActivePaidSubscription, isInGracePeriod, graceDaysRemaining } from '@/lib/subscription-helpers'
import {
  APP_VERSION,
  BULK_ACTIONS,
  canPermanentlyDelete,
  confirmationMatchesClinicName,
  daysSince,
  deriveConsoleStatus,
  filterConsoleClinics,
  formatBytes,
  inactivityBucket,
  paginateRows,
  sortConsoleClinics,
  summarizeConsoleKpis,
} from '@/lib/platform-admin-console-core'

export {
  APP_VERSION,
  BULK_ACTIONS,
  CONSOLE_STATUSES,
  CONSOLE_STATUS_LABELS,
  CONSOLE_STATUS_TONES,
  PLAN_OPTIONS,
  canClinicStaffLogin,
  canPermanentlyDelete,
  confirmationMatchesClinicName,
  daysSince,
  deriveConsoleStatus,
  filterConsoleClinics,
  formatBytes,
  inactivityBucket,
  paginateRows,
  parseClinicListQuery,
  sortConsoleClinics,
  summarizeConsoleKpis,
  trendFromCounts,
} from '@/lib/platform-admin-console-core'

function laterDate(a, b) {
  const dates = [a, b].filter(Boolean).map(d => new Date(d)).filter(d => !Number.isNaN(d.getTime()))
  if (dates.length === 0) return null
  dates.sort((x, y) => y - x)
  return dates[0]
}

function isSubscriptionExpired(sub, clinic, now = new Date()) {
  if (!sub && !clinic) return false
  if (isActivePaidSubscription(sub)) return false
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null
  if (periodEnd && periodEnd < now && sub?.subscription_status === 'active') return true
  const trialEnd = clinic?.trial_ends_at ? new Date(clinic.trial_ends_at) : null
  if (trialEnd && trialEnd < now && (sub?.subscription_status === 'trial' || !isActivePaidSubscription(sub))) {
    if (sub?.subscription_status === 'cancelled') return true
    if (clinic?.subscription_status === 'blocked' && sub?.subscription_reason === 'trial_expired') return true
    if (trialEnd < now && sub?.subscription_status === 'trial') return true
  }
  if (sub?.subscription_status === 'cancelled') return true
  return false
}

/**
 * @param {import('mongodb').Db} db
 * @param {object[]} clinics
 */
export async function enrichClinicRows(db, clinics) {
  if (!clinics.length) return []
  const clinicIds = clinics.map(c => c.id)
  const ownerIds = clinics.map(c => c.owner_id).filter(Boolean)

  const [
    subscriptions,
    staffAgg,
    visitActivity,
    patientCounts,
    appointmentCounts,
    paymentSums,
    workspaces,
    owners,
    noteCounts,
  ] = await Promise.all([
    db.collection('subscriptions')
      .find({ clinic_id: { $in: clinicIds } })
      .project({
        _id: 0,
        clinic_id: 1,
        plan_type: 1,
        subscription_status: 1,
        platform_status: 1,
        subscription_reason: 1,
        current_period_end: 1,
        current_period_start: 1,
        grace_period_end: 1,
        razorpay_subscription_id: 1,
        subscription_id: 1,
        razorpay_customer_id: 1,
        customer_id: 1,
        payment_method: 1,
        created_at: 1,
      })
      .toArray()
      .catch(() => []),
    db.collection('profiles').aggregate([
      { $match: { clinic_id: { $in: clinicIds }, deleted_at: { $exists: false } } },
      {
        $group: {
          _id: '$clinic_id',
          last_staff_login: { $max: '$last_login_at' },
          sessions: { $sum: { $ifNull: ['$login_count', 0] } },
          doctors: { $sum: { $cond: [{ $eq: ['$role', 'doctor'] }, 1, 0] } },
          receptionists: { $sum: { $cond: [{ $eq: ['$role', 'receptionist'] }, 1, 0] } },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          logged_in_staff: { $sum: { $cond: [{ $ifNull: ['$last_login_at', false] }, 1, 0] } },
        },
      },
    ]).toArray().catch(() => []),
    db.collection('visits').aggregate([
      { $match: { clinic_id: { $in: clinicIds } } },
      { $group: { _id: '$clinic_id', last_visit_date: { $max: '$visit_date' }, visits: { $sum: 1 } } },
    ]).toArray().catch(() => []),
    db.collection('patients').aggregate([
      { $match: { clinic_id: { $in: clinicIds }, deleted_at: { $exists: false } } },
      { $group: { _id: '$clinic_id', count: { $sum: 1 } } },
    ]).toArray().catch(() => []),
    db.collection('appointments').aggregate([
      { $match: { clinic_id: { $in: clinicIds } } },
      { $group: { _id: '$clinic_id', count: { $sum: 1 } } },
    ]).toArray().catch(() => []),
    db.collection('clinic_manual_payments').aggregate([
      { $match: { clinic_id: { $in: clinicIds } } },
      { $group: { _id: '$clinic_id', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).toArray().catch(() => []),
    db.collection('clinic_workspaces')
      .find({ clinic_id: { $in: clinicIds } })
      .project({ _id: 0, clinic_id: 1, presets: 1, homepage: 1, layout: 1, active_preset_id: 1 })
      .toArray()
      .catch(() => []),
    ownerIds.length
      ? db.collection('profiles')
        .find({ id: { $in: ownerIds } })
        .project({ _id: 0, id: 1, full_name: 1, email: 1, phone: 1, role: 1 })
        .toArray()
        .catch(() => [])
      : Promise.resolve([]),
    db.collection('clinic_support_notes').aggregate([
      { $match: { clinic_id: { $in: clinicIds } } },
      { $group: { _id: '$clinic_id', count: { $sum: 1 }, last: { $max: '$created_at' } } },
    ]).toArray().catch(() => []),
  ])

  const adminFallback = await db.collection('profiles').aggregate([
    { $match: { clinic_id: { $in: clinicIds }, deleted_at: { $exists: false }, role: 'admin' } },
    { $sort: { created_at: 1 } },
    {
      $group: {
        _id: '$clinic_id',
        full_name: { $first: '$full_name' },
        email: { $first: '$email' },
        phone: { $first: '$phone' },
        id: { $first: '$id' },
      },
    },
  ]).toArray().catch(() => [])

  const subMap = Object.fromEntries((subscriptions || []).map(s => [s.clinic_id, s]))
  const staffMap = Object.fromEntries((staffAgg || []).map(r => [r._id, r]))
  const visitMap = Object.fromEntries((visitActivity || []).map(r => [r._id, r]))
  const patientMap = Object.fromEntries((patientCounts || []).map(r => [r._id, r.count]))
  const appointmentMap = Object.fromEntries((appointmentCounts || []).map(r => [r._id, r.count]))
  const paymentMap = Object.fromEntries((paymentSums || []).map(r => [r._id, r]))
  const workspaceMap = Object.fromEntries((workspaces || []).map(w => [w.clinic_id, w]))
  const ownerMap = Object.fromEntries((owners || []).map(o => [o.id, o]))
  const adminMap = Object.fromEntries((adminFallback || []).map(r => [r._id, r]))
  const noteMap = Object.fromEntries((noteCounts || []).map(r => [r._id, r]))

  const now = Date.now()

  return clinics.map(c => {
    const sub = subMap[c.id] || {}
    const staff = staffMap[c.id] || {}
    const visit = visitMap[c.id] || {}
    const owner = (c.owner_id && ownerMap[c.owner_id]) || adminMap[c.id] || null
    const lastStaffLogin = staff.last_staff_login || null
    const lastVisitDate = visit.last_visit_date || null
    const lastActivity = laterDate(lastStaffLogin, lastVisitDate)
    const daysInactive = daysSince(lastActivity, now)
    const bucket = inactivityBucket(daysInactive)
    const inGrace = isInGracePeriod(sub)
    const graceDays = graceDaysRemaining(sub)
    const paid = isActivePaidSubscription(sub)
    const expired = isSubscriptionExpired(sub, c)
    const sessions = Number(staff.sessions) > 0
      ? Number(staff.sessions)
      : Number(staff.logged_in_staff) || 0
    const workspace = workspaceMap[c.id] || null
    const presets = Array.isArray(workspace?.presets) ? workspace.presets : []
    const activePreset = workspace?.active_preset_id
      || presets.find(p => p?.active)?.id
      || presets[0]?.id
      || null
    const workflowMode = workspace?.layout?.density
      || workspace?.homepage
      || activePreset
      || 'default'

    const row = {
      id: c.id,
      name: c.name,
      slug: c.slug || null,
      phone: c.phone || owner?.phone || null,
      owner_id: c.owner_id || owner?.id || null,
      owner_name: owner?.full_name || null,
      owner_email: owner?.email || null,
      created_at: c.created_at,
      is_active: c.is_active !== false,
      onboarding_complete: !!c.onboarding_complete,
      plan_type: sub.plan_type || c.subscription_plan || null,
      subscription_status: c.subscription_status === 'blocked' ? 'blocked' : 'active',
      billing_status: sub.subscription_status || null,
      platform_status: sub.platform_status ?? null,
      subscription_reason: sub.subscription_reason || null,
      monthly_ai_usage_limit: c.monthly_ai_usage_limit ?? null,
      trial_auto_enforcement: c.trial_auto_enforcement || 'auto',
      manual_access_granted_at: c.manual_access_granted_at || null,
      last_staff_login: lastStaffLogin,
      last_visit_date: lastVisitDate,
      last_activity: lastActivity,
      days_since_last_activity: daysInactive,
      inactivity_bucket: bucket?.id || null,
      inactivity_label: bucket?.label || null,
      trial_ends_at: c.trial_ends_at || null,
      current_period_end: sub.current_period_end || null,
      current_period_start: sub.current_period_start || null,
      grace_period_end: sub.grace_period_end || null,
      grace_days_remaining: inGrace ? graceDays : null,
      days_remaining: inGrace ? graceDays : null,
      subscription_id: sub.razorpay_subscription_id || sub.subscription_id || null,
      customer_id: sub.razorpay_customer_id || sub.customer_id || null,
      payment_method: sub.payment_method || null,
      features: { ...DEFAULT_FEATURES, ...(c.features || {}) },
      emergency_locked_at: c.emergency_locked_at || null,
      emergency_locked_by: c.emergency_locked_by || null,
      emergency_locked_reason: c.emergency_locked_reason || null,
      is_in_grace: inGrace,
      is_payment_failed: sub.subscription_status === 'halted' || sub.subscription_reason === 'payment_failed',
      is_comped: sub.platform_status === 'comped',
      is_emergency_locked: c.subscription_status === 'blocked' && !!c.emergency_locked_at,
      is_manual_override: ['force_active', 'force_trial', 'active'].includes(sub.platform_status),
      is_paid: paid,
      subscription_expired: expired,
      doctor_count: staff.doctors || 0,
      receptionist_count: staff.receptionists || 0,
      admin_count: staff.admins || 0,
      patient_count: patientMap[c.id] || 0,
      appointment_count: appointmentMap[c.id] || 0,
      visit_count: visit.visits || 0,
      session_count: sessions,
      revenue_total: paymentMap[c.id]?.total || 0,
      payment_count: paymentMap[c.id]?.count || 0,
      version: c.app_version || c.client_version || APP_VERSION,
      workflow_mode: workflowMode,
      platform_notes: c.platform_notes || '',
      deactivation_reason: c.deactivation_reason || null,
      deactivated_at: c.deactivated_at || null,
      deactivated_by: c.deactivated_by || null,
      deleted_at: c.deleted_at || null,
      permanently_deleted_at: c.permanently_deleted_at || null,
      note_count: noteMap[c.id]?.count || 0,
      last_note_at: noteMap[c.id]?.last || null,
    }

    row.console_status = deriveConsoleStatus(row)
    return row
  })
}

export async function listConsoleClinics(db, query = {}) {
  const clinics = await db.collection('clinics')
    .find({})
    .project({
      _id: 0,
      id: 1,
      name: 1,
      slug: 1,
      phone: 1,
      owner_id: 1,
      created_at: 1,
      is_active: 1,
      onboarding_complete: 1,
      subscription_status: 1,
      subscription_plan: 1,
      monthly_ai_usage_limit: 1,
      trial_auto_enforcement: 1,
      manual_access_granted_at: 1,
      trial_ends_at: 1,
      features: 1,
      emergency_locked_at: 1,
      emergency_locked_by: 1,
      emergency_locked_reason: 1,
      app_version: 1,
      client_version: 1,
      platform_notes: 1,
      deactivation_reason: 1,
      deactivated_at: 1,
      deactivated_by: 1,
      deleted_at: 1,
      permanently_deleted_at: 1,
    })
    .sort({ created_at: -1 })
    .toArray()

  const enriched = await enrichClinicRows(db, clinics)
  const kpis = summarizeConsoleKpis(enriched)
  const filtered = filterConsoleClinics(enriched, query)
  const sorted = sortConsoleClinics(filtered, query.sort, query.order)
  if (query.all) {
    return {
      clinics: sorted,
      total: sorted.length,
      page: 1,
      pageSize: sorted.length,
      pageCount: 1,
      plans: uniquePlans(enriched),
      kpis,
    }
  }
  const page = paginateRows(sorted, query.page, query.pageSize)
  return {
    clinics: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    pageCount: page.pageCount,
    plans: uniquePlans(enriched),
    kpis,
  }
}

function uniquePlans(rows) {
  return Array.from(new Set(rows.map(r => r.plan_type).filter(Boolean))).sort()
}

export async function getClinicConsoleDetail(db, clinicId) {
  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return null

  const [rows, documents, invoices, storageAgg, recentLogs] = await Promise.all([
    enrichClinicRows(db, [clinic]),
    db.collection('documents').countDocuments({ clinic_id: clinicId, deleted_at: { $exists: false } }).catch(() => 0),
    db.collection('invoices').countDocuments({ clinic_id: clinicId }).catch(() => 0),
    db.collection('documents').aggregate([
      { $match: { clinic_id: clinicId, deleted_at: { $exists: false } } },
      { $group: { _id: null, bytes: { $sum: { $ifNull: ['$size', { $ifNull: ['$bytes', 0] }] } }, files: { $sum: 1 } } },
    ]).toArray().catch(() => []),
    db.collection('platform_admin_audit_logs')
      .find({ target_clinic_id: clinicId })
      .sort({ at: -1 })
      .limit(12)
      .toArray(),
  ])

  const row = rows[0]
  const storage = storageAgg[0] || { bytes: 0, files: 0 }

  return {
    ...row,
    invoice_count: invoices,
    document_count: documents,
    storage_bytes: storage.bytes || 0,
    storage_files: storage.files || documents,
    recent_logs: recentLogs.map(({ _id, ...rest }) => rest),
  }
}

export async function deactivateClinic(db, actor, clinicId, { reason } = {}) {
  const trimmed = String(reason || '').trim()
  if (!trimmed) return { ok: false, error: 'A reason is required to deactivate a clinic' }

  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return { ok: false, error: 'Clinic not found' }
  if (clinic.deleted_at || clinic.permanently_deleted_at) {
    return { ok: false, error: 'Deleted clinics cannot be deactivated' }
  }

  const blocked = await blockClinic(db, actor, clinicId, {
    from: clinic.subscription_status === 'blocked' ? 'blocked' : 'active',
    subscriptionReason: 'admin_lock',
  })
  if (!blocked.ok) return blocked

  const now = new Date()
  await db.collection('clinics').updateOne(
    { id: clinicId },
    {
      $set: {
        is_active: false,
        deactivation_reason: trimmed,
        deactivated_at: now,
        deactivated_by: actor?.email || '',
        updated_at: now,
      },
    }
  )

  await logPlatformAudit(db, {
    actor,
    action: AUDIT_ACTIONS.CLINIC_DEACTIVATED,
    targetClinicId: clinicId,
    targetClinicName: clinic.name,
    meta: { reason: trimmed },
  })

  return { ok: true }
}

export async function activateClinic(db, actor, clinicId) {
  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return { ok: false, error: 'Clinic not found' }
  if (clinic.deleted_at || clinic.permanently_deleted_at) {
    return { ok: false, error: 'Deleted clinics cannot be reactivated' }
  }

  const unblocked = await unblockClinic(db, actor, clinicId, {
    from: clinic.subscription_status === 'blocked' ? 'blocked' : 'active',
  })
  if (!unblocked.ok) return unblocked

  const now = new Date()
  await db.collection('clinics').updateOne(
    { id: clinicId },
    {
      $set: {
        is_active: true,
        updated_at: now,
        reactivated_at: now,
        reactivated_by: actor?.email || '',
      },
    }
  )

  await logPlatformAudit(db, {
    actor,
    action: AUDIT_ACTIONS.CLINIC_REACTIVATED,
    targetClinicId: clinicId,
    targetClinicName: clinic.name,
    meta: { previous_reason: clinic.deactivation_reason || null },
  })

  return { ok: true }
}

export async function permanentlyDeleteClinic(db, actor, clinicId, { confirmationName } = {}) {
  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const allowed = canPermanentlyDelete(clinic)
  if (!allowed.ok) return allowed

  if (!confirmationMatchesClinicName(clinic.name, confirmationName)) {
    return { ok: false, error: 'Typed name does not match the clinic name' }
  }

  const now = new Date()
  const { _id, ...snapshot } = clinic
  void _id

  await db.collection('deleted_clinics').insertOne({
    ...snapshot,
    archived_at: now,
    archived_by: actor?.email || '',
    archive_id: uuidv4(),
  })

  await db.collection('clinics').updateOne(
    { id: clinicId },
    {
      $set: {
        is_active: false,
        subscription_status: 'blocked',
        deleted_at: now,
        permanently_deleted_at: now,
        deleted_by: actor?.email || '',
        updated_at: now,
      },
    }
  )

  await logPlatformAudit(db, {
    actor,
    action: AUDIT_ACTIONS.CLINIC_PERMANENTLY_DELETED,
    targetClinicId: clinicId,
    targetClinicName: clinic.name,
    meta: { irreversible: true },
  })

  return { ok: true }
}

export async function changeClinicPlan(db, actor, clinicId, { planType } = {}) {
  const plan = String(planType || '').trim().toLowerCase()
  if (!plan) return { ok: false, error: 'plan_type is required' }

  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return { ok: false, error: 'Clinic not found' }
  if (clinic.deleted_at) return { ok: false, error: 'Deleted clinics cannot change plan' }

  const sub = await db.collection('subscriptions').findOne({ clinic_id: clinicId })
  const from = sub?.plan_type || clinic.subscription_plan || null

  await db.collection('subscriptions').updateOne(
    { clinic_id: clinicId },
    { $set: { plan_type: plan, updated_at: new Date() } },
    { upsert: true }
  )
  await db.collection('clinics').updateOne(
    { id: clinicId },
    { $set: { subscription_plan: plan, updated_at: new Date() } }
  )

  await logPlatformAudit(db, {
    actor,
    action: AUDIT_ACTIONS.CLINIC_PLAN_CHANGED,
    targetClinicId: clinicId,
    targetClinicName: clinic.name,
    meta: { from, to: plan },
  })

  return { ok: true, plan_type: plan }
}

export async function extendClinicTrial(db, actor, clinicId, { days = 14 } = {}) {
  const n = Number(days)
  if (!Number.isFinite(n) || n === 0) return { ok: false, error: 'days must be a non-zero number' }

  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return { ok: false, error: 'Clinic not found' }
  if (clinic.deleted_at) return { ok: false, error: 'Deleted clinics cannot extend trial' }

  const base = clinic.trial_ends_at && new Date(clinic.trial_ends_at) > new Date()
    ? new Date(clinic.trial_ends_at)
    : new Date()
  base.setDate(base.getDate() + n)
  return setTrialEndDate(db, actor, clinicId, { date: base.toISOString() })
}

export async function markClinicPaid(db, actor, clinicId, {
  amount = 0,
  method = 'manual',
  date = null,
  note = 'Marked as paid by platform admin',
  planType = null,
} = {}) {
  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return { ok: false, error: 'Clinic not found' }

  const paymentDate = date ? new Date(date) : new Date()
  const sub = await db.collection('subscriptions').findOne({ clinic_id: clinicId })
  const plan = planType || sub?.plan_type || 'monthly'
  const periodEnd = new Date(paymentDate)
  if (plan === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  else periodEnd.setMonth(periodEnd.getMonth() + 1)

  const recorded = await recordManualPayment(db, actor, clinicId, {
    date: paymentDate.toISOString().slice(0, 10),
    amount,
    method,
    note,
  })
  if (!recorded.ok) return recorded

  const activation = await activateSubscription(db, clinicId, {
    periodEnd,
    periodStart: paymentDate,
    planType: plan,
    lastPaymentDate: paymentDate,
    clearGrace: true,
    reason: 'manual_payment',
    clearEmergencyLock: true,
  })
  if (!activation.ok) return activation

  await db.collection('clinics').updateOne(
    { id: clinicId },
    { $set: { is_active: true, updated_at: new Date() } }
  )

  return { ok: true, payment: recorded.payment }
}

export async function pauseClinicSubscription(db, actor, clinicId, { reason } = {}) {
  return pauseSubscription(db, actor, clinicId, { reason })
}

export async function resumeClinicSubscription(db, actor, clinicId) {
  const result = await applyLifecycle(db, actor, clinicId, { status: 'active', force: true })
  if (!result.ok) return result
  await db.collection('clinics').updateOne(
    { id: clinicId },
    { $set: { is_active: true, updated_at: new Date() } }
  )
  return result
}

export async function saveClinicNotes(db, actor, clinicId, notes) {
  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  if (!clinic) return { ok: false, error: 'Clinic not found' }
  const platform_notes = String(notes || '')
  await db.collection('clinics').updateOne(
    { id: clinicId },
    { $set: { platform_notes, updated_at: new Date() } }
  )
  await logPlatformAudit(db, {
    actor,
    action: AUDIT_ACTIONS.LEAD_NOTE_UPDATED,
    targetClinicId: clinicId,
    targetClinicName: clinic.name,
    meta: { length: platform_notes.length },
  })
  return { ok: true, platform_notes }
}

export async function runBulkClinicAction(db, actor, {
  action,
  clinicIds = [],
  reason = '',
  days = 14,
  confirmation = '',
} = {}) {
  if (!BULK_ACTIONS.includes(action)) return { ok: false, error: 'Unknown bulk action' }
  if (action === 'send_email' || action === 'export') {
    return { ok: false, error: `${action} is handled by the client` }
  }
  const ids = Array.from(new Set((clinicIds || []).filter(Boolean)))
  if (ids.length === 0) return { ok: false, error: 'Select at least one clinic' }

  const results = []
  for (const id of ids) {
    let result = { ok: false, error: 'Unhandled' }
    if (action === 'activate') result = await activateClinic(db, actor, id)
    else if (action === 'deactivate') result = await deactivateClinic(db, actor, id, { reason })
    else if (action === 'extend_trial') result = await extendClinicTrial(db, actor, id, { days })
    else if (action === 'delete') {
      const clinic = await db.collection('clinics').findOne({ id })
      if (!clinic) result = { ok: false, error: 'Clinic not found' }
      else if (confirmation !== 'DELETE') result = { ok: false, error: 'Type DELETE to confirm bulk permanent delete' }
      else result = await permanentlyDeleteClinic(db, actor, id, { confirmationName: clinic.name })
    }
    results.push({ id, ok: result.ok, error: result.error || null })
  }

  await logPlatformAudit(db, {
    actor,
    action: AUDIT_ACTIONS.BULK_ACTION,
    meta: {
      bulk_action: action,
      count: ids.length,
      succeeded: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
    },
  })

  return {
    ok: results.every(r => r.ok),
    results,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
  }
}

export async function collectSystemHealth(db) {
  const now = new Date()
  const onlineSince = new Date(now.getTime() - 15 * 60 * 1000)
  const checks = []

  try {
    const t0 = Date.now()
    await db.command({ ping: 1 })
    const latency = Date.now() - t0
    checks.push({
      id: 'database',
      name: 'Database',
      status: latency < 100 ? 'healthy' : latency < 500 ? 'warning' : 'failed',
      value: `${latency}ms`,
      label: 'MongoDB ping',
    })
  } catch {
    checks.push({ id: 'database', name: 'Database', status: 'failed', value: null, label: 'Connection error' })
  }

  const onlineUsers = await db.collection('profiles').countDocuments({
    last_login_at: { $gte: onlineSince },
    deleted_at: { $exists: false },
    is_platform_admin: { $ne: true },
  }).catch(() => 0)

  checks.push({
    id: 'online',
    name: 'Users online',
    status: 'healthy',
    value: String(onlineUsers),
    label: 'Staff logged in within 15 minutes',
  })

  const aiOk = !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.EMERGENT_LLM_KEY)
  checks.push({
    id: 'ai',
    name: 'AI service',
    status: aiOk ? 'healthy' : 'warning',
    value: aiOk ? 'Configured' : 'Not set',
    label: 'Gemini / Anthropic',
  })

  const docs = await db.collection('documents').aggregate([
    { $match: { deleted_at: { $exists: false } } },
    { $group: { _id: null, bytes: { $sum: { $ifNull: ['$size', { $ifNull: ['$bytes', 0] }] } }, files: { $sum: 1 } } },
  ]).toArray().catch(() => [])
  const storage = docs[0] || { bytes: 0, files: 0 }
  checks.push({
    id: 'storage',
    name: 'Storage',
    status: 'healthy',
    value: storage.bytes > 0 ? formatBytes(storage.bytes) : `${storage.files || 0} files`,
    label: 'Documents stored across clinics',
  })

  const settings = await db.collection('platform_settings').findOne({ _type: 'global' }).catch(() => null)
  const lastCron = settings?.last_cron_run
  if (!lastCron) {
    checks.push({ id: 'jobs', name: 'Background jobs', status: 'warning', value: 'Never', label: 'No cron run recorded' })
  } else {
    const hoursAgo = Math.floor((Date.now() - new Date(lastCron).getTime()) / (1000 * 60 * 60))
    checks.push({
      id: 'jobs',
      name: 'Background jobs',
      status: hoursAgo > 25 ? 'warning' : 'healthy',
      value: `${hoursAgo}h ago`,
      label: 'Trial / grace expiry job',
    })
  }

  const recentErrors = await db.collection('platform_admin_audit_logs')
    .find({
      action: {
        $in: [
          'trial_expired_auto_blocked',
          'grace_expired_auto_blocked',
          'payment_failed_grace_started',
          'emergency_lock',
        ],
      },
      at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
    .sort({ at: -1 })
    .limit(8)
    .toArray()
    .catch(() => [])

  checks.push({
    id: 'errors',
    name: 'Recent errors',
    status: recentErrors.length > 3 ? 'warning' : 'healthy',
    value: String(recentErrors.length),
    label: recentErrors[0] ? recentErrors[0].action.replace(/_/g, ' ') : 'No alerts in 7 days',
  })

  const emailOk = !!process.env.RESEND_API_KEY || !!process.env.SMTP_HOST
  checks.push({
    id: 'email',
    name: 'Email',
    status: emailOk ? 'healthy' : 'warning',
    value: emailOk ? 'Configured' : 'Not set',
    label: 'Transactional email',
  })

  return {
    checks,
    online_users: onlineUsers,
    recent_errors: recentErrors.map(({ _id, ...rest }) => rest),
    at: now.toISOString(),
  }
}

