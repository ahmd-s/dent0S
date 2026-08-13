/**
 * Dashboard stats builder — optimized clinic-scoped summary for the main dashboard.
 * Preserves the existing /api/dashboard/stats response shape.
 */

import { AWAITING_ACCEPTANCE_STATUSES, IN_PRODUCTION_STATUSES, READY_STATUSES, CLOSED_STATUSES } from '@/lib/lab-case-helpers'
import { getProfileRoles } from '@/lib/profile-roles'
import { doctorAppointmentFilter, shouldScopeToDoctor } from '@/lib/doctor-scope'
import { computeFlowMetricsFromAppointments } from '@/lib/dental-flow-engine'
import { computeLabMetricsLite } from '@/lib/lab-workflow-engine'
import { computeInventoryMetricsLite } from '@/lib/inventory-workflow-engine'
import { getKpis } from '@/lib/analytics-engine'
import { getCommunicationDashboard } from '@/lib/communication-engine'
import { getAIDashboardLite } from '@/lib/ai-engine'
import { getClinicDateIso } from '@/lib/communication/timezone'
import {
  dashboardCacheKey,
  getOrComputeDashboardCache,
} from '@/lib/dashboard-cache'
import {
  invalidateClinicDashboard,
  invalidateDashboardRelatedCaches,
} from '@/lib/dashboard-invalidation'

const clean = o => {
  if (!o) return o
  const { _id, password_hash, ...rest } = o
  return rest
}

function clinicTimezone(clinic) {
  return clinic?.timezone || clinic?.settings?.timezone || process.env.COMMUNICATION_DEFAULT_TIMEZONE || 'Asia/Kolkata'
}

function scopeKeyForProfile(profile) {
  const roles = getProfileRoles(profile)
  if (shouldScopeToDoctor(roles)) return `doctor:${profile.id}`
  // Non-doctor scopes share clinic-wide operational data
  return 'all'
}

function shiftIsoDays(iso, delta) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

const APPT_QUEUE_PROJECTION = {
  _id: 0,
  id: 1,
  clinic_id: 1,
  patient_id: 1,
  doctor_id: 1,
  appointment_date: 1,
  appointment_time: 1,
  appointment_type: 1,
  status: 1,
  chief_complaint: 1,
  patient_name_temp: 1,
  patient_phone_temp: 1,
  priority: 1,
  chair_id: 1,
  treatment_started_at: 1,
  completed_at: 1,
  checked_in_at: 1,
  waiting_started_at: 1,
  called_at: 1,
}

const FOLLOWUP_PROJECTION = {
  _id: 0,
  id: 1,
  name: 1,
  phone: 1,
  next_followup_date: 1,
  last_visit_date: 1,
  last_visit_reason: 1,
}

const PATIENT_NAME_PROJECTION = { _id: 0, id: 1, name: 1, phone: 1 }
const PROFILE_NAME_PROJECTION = { _id: 0, id: 1, full_name: 1 }
const VISIT_LINK_PROJECTION = { _id: 0, id: 1, appointment_id: 1 }

async function labStatusCounts(db, clinicId, today) {
  const rows = await db.collection('lab_cases').aggregate([
    { $match: { clinic_id: clinicId } },
    {
      $group: {
        _id: null,
        active: {
          $sum: { $cond: [{ $not: [{ $in: ['$status', CLOSED_STATUSES] }] }, 1, 0] },
        },
        overdue: {
          $sum: {
            $cond: [{
              $and: [
                { $not: [{ $in: ['$status', CLOSED_STATUSES] }] },
                { $ne: ['$expected_delivery_date', null] },
                { $lt: ['$expected_delivery_date', today] },
              ],
            }, 1, 0],
          },
        },
        awaiting: {
          $sum: { $cond: [{ $in: ['$status', AWAITING_ACCEPTANCE_STATUSES] }, 1, 0] },
        },
        in_production: {
          $sum: { $cond: [{ $in: ['$status', IN_PRODUCTION_STATUSES] }, 1, 0] },
        },
        ready: {
          $sum: { $cond: [{ $in: ['$status', READY_STATUSES] }, 1, 0] },
        },
      },
    },
  ]).toArray()

  const r = rows[0] || {}
  return {
    active_lab_cases: r.active || 0,
    overdue_lab_cases: r.overdue || 0,
    awaiting_lab_acceptance: r.awaiting || 0,
    in_production_lab_cases: r.in_production || 0,
    ready_lab_cases: r.ready || 0,
  }
}

/** Lightweight communication urgency metrics for core mode (no full message bodies). */
async function communicationUrgencyLite(db, clinicId, today) {
  const startOfDay = new Date(today)
  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)
  const [pending, scheduledToday, failedToday] = await Promise.all([
    db.collection('communication_messages').countDocuments({ clinic_id: clinicId, status: 'pending' }),
    db.collection('communication_messages').countDocuments({
      clinic_id: clinicId,
      status: 'scheduled',
      scheduled_at: { $gte: startOfDay, $lte: endOfDay },
    }),
    db.collection('communication_messages').countDocuments({
      clinic_id: clinicId,
      status: 'failed',
      created_at: { $gte: startOfDay, $lte: endOfDay },
    }),
  ])
  return {
    ok: true,
    pending,
    scheduled_today: scheduledToday,
    failed: failedToday,
    // placeholders so widgets that read other keys degrade gracefully
    todays_reminders: pending + scheduledToday,
    delivered: 0,
    review_requests: 0,
    birthdays: 0,
    payment_reminders: 0,
    lab_notifications: 0,
    appointment_reminders: 0,
    recent_activity: [],
    upcoming_scheduled: [],
  }
}

async function settledValue(promise, fallback = null) {
  const r = await Promise.resolve(promise).then(
    value => ({ ok: true, value }),
    error => ({ ok: false, error })
  )
  if (r.ok) return r.value
  console.error('Dashboard module failed:', r.error?.message || r.error)
  return fallback
}

async function computeDashboardPayload(db, profile, clinic, { mode, today, yest, timezone, timings, marks, t0 }) {
  const cid = profile.clinic_id
  const roles = getProfileRoles(profile)
  const doctorFilter = doctorAppointmentFilter(roles, profile.id)
  const mark = label => { if (marks) marks[label] = Math.round(performance.now() - t0) }

  const apptFilter = { clinic_id: cid, appointment_date: today, ...doctorFilter }
  const followupFilter = {
    clinic_id: cid,
    is_archived: { $ne: true },
    next_followup_date: { $ne: null, $lte: today },
  }

  const [
    todayAppts,
    doneToday,
    doneYest,
    revAgg,
    pendAgg,
    followups,
    fcount,
    labCounts,
    chairs,
    inventoryMetrics,
    communicationLite,
  ] = await Promise.all([
    db.collection('appointments')
      .find(apptFilter)
      .project(APPT_QUEUE_PROJECTION)
      .sort({ appointment_time: 1 })
      .limit(200)
      .toArray(),
    db.collection('appointments').countDocuments({ ...apptFilter, status: 'completed' }),
    db.collection('appointments').countDocuments({
      clinic_id: cid,
      appointment_date: yest,
      status: 'completed',
      ...doctorFilter,
    }),
    db.collection('invoices').aggregate([
      { $match: { clinic_id: cid, payment_status: 'paid', invoice_date: today } },
      { $group: { _id: null, sum: { $sum: '$total_amount' } } },
    ]).toArray(),
    db.collection('invoices').aggregate([
      { $match: { clinic_id: cid, payment_status: { $in: ['pending', 'partial'] }, invoice_date: today } },
      { $group: { _id: null, sum: { $sum: '$total_amount' } } },
    ]).toArray(),
    db.collection('patients')
      .find(followupFilter)
      .project(FOLLOWUP_PROJECTION)
      .sort({ next_followup_date: 1 })
      .limit(5)
      .toArray(),
    db.collection('patients').countDocuments(followupFilter),
    labStatusCounts(db, cid, today),
    db.collection('clinic_chairs')
      .find({ clinic_id: cid, is_active: { $ne: false } })
      .project({ _id: 0, id: 1, status: 1, clinic_id: 1 })
      .toArray(),
    // Core includes inventory alerts (default widget)
    settledValue(computeInventoryMetricsLite(db, cid), null),
    // Core includes communication urgency queue counts
    settledValue(communicationUrgencyLite(db, cid, today), null),
  ])
  mark?.('core_queries')

  const pids = [...new Set(todayAppts.map(a => a.patient_id).filter(Boolean))]
  const dids = [...new Set(todayAppts.map(a => a.doctor_id).filter(Boolean))]
  const apptIds = todayAppts.map(a => a.id)

  const [pts, docs, visits] = await Promise.all([
    pids.length
      ? db.collection('patients').find({ id: { $in: pids }, clinic_id: cid }).project(PATIENT_NAME_PROJECTION).toArray()
      : [],
    dids.length
      ? db.collection('profiles').find({ id: { $in: dids }, clinic_id: cid }).project(PROFILE_NAME_PROJECTION).toArray()
      : [],
    apptIds.length
      ? db.collection('visits').find({ clinic_id: cid, appointment_id: { $in: apptIds } }).project(VISIT_LINK_PROJECTION).toArray()
      : [],
  ])
  mark?.('lookups')

  const pmap = Object.fromEntries(pts.map(p => [p.id, { name: p.name, phone: p.phone }]))
  const dmap = Object.fromEntries(docs.map(d => [d.id, d.full_name]))
  const vmap = Object.fromEntries(visits.map(v => [v.appointment_id, v.id]))
  const flowMetrics = computeFlowMetricsFromAppointments(todayAppts, chairs)

  const corePayload = {
    clinic_name: clinic?.name,
    patients_seen_today: doneToday,
    patients_seen_yesterday: doneYest,
    revenue_today: revAgg[0]?.sum || 0,
    pending_today: pendAgg[0]?.sum || 0,
    followups_due_count: fcount,
    ...labCounts,
    today_queue: todayAppts.map(a => ({
      ...clean(a),
      patient_name: pmap[a.patient_id]?.name || a.patient_name_temp,
      patient_phone: pmap[a.patient_id]?.phone || a.patient_phone_temp,
      doctor_name: dmap[a.doctor_id] || '',
      visit_id: vmap[a.id] || null,
    })),
    followups: followups.map(p => ({ ...clean(p), last_visit_reason: p.last_visit_reason || '' })),
    flow: flowMetrics,
    inventory: inventoryMetrics,
    // Lab alert counts are top-level; detailed lab object filled in full mode
    lab: mode === 'core' ? {
      open_cases: labCounts.active_lab_cases,
      delayed_cases: labCounts.overdue_lab_cases,
      awaiting_dispatch: labCounts.ready_lab_cases,
    } : null,
    communication: communicationLite,
    analytics: null,
    ai: null,
    _meta: { timezone, date: today, mode, scope: scopeKeyForProfile(profile) },
  }

  if (mode === 'core') {
    mark?.('total')
    return corePayload
  }

  const [labMetrics, analyticsKpis, communicationDashboard, aiDashboard] = await Promise.all([
    settledValue(computeLabMetricsLite(db, cid), corePayload.lab),
    settledValue(getKpis(db, cid, { days: 30 }), null),
    settledValue(getCommunicationDashboard(db, cid), communicationLite),
    settledValue(getAIDashboardLite(db, cid), null),
  ])
  mark?.('modules')

  const payload = {
    ...corePayload,
    lab: labMetrics,
    inventory: inventoryMetrics,
    analytics: analyticsKpis,
    communication: communicationDashboard,
    ai: aiDashboard,
  }
  mark?.('total')
  return payload
}

/**
 * Build dashboard stats.
 * @param {'full'|'core'} mode
 *   core = operational urgency (queue, KPIs today, lab counts, inventory alerts, comm queue)
 *   full = core + analytics/AI/full communication/lab detail
 */
export async function buildDashboardStats(db, profile, clinic, { mode = 'full', skipCache = false, timings = false } = {}) {
  const timezone = clinicTimezone(clinic)
  const today = getClinicDateIso(timezone)
  const yest = shiftIsoDays(today, -1)
  const scopeKey = scopeKeyForProfile(profile)
  const cacheKey = dashboardCacheKey({
    clinicId: profile.clinic_id,
    scopeKey,
    mode,
    date: today,
    timezone,
  })

  const t0 = performance.now()
  const marks = {}

  const compute = () => computeDashboardPayload(db, profile, clinic, {
    mode, today, yest, timezone, timings, marks, t0,
  })

  if (skipCache) {
    const payload = await compute()
    if (!timings) {
      const { _meta, ...rest } = payload
      return rest
    }
    return { ...payload, _cache: 'bypass', _timings: marks, _cache_key: cacheKey }
  }

  const { data, cache } = await getOrComputeDashboardCache(cacheKey, compute)
  if (!timings) {
    const { _meta, ...rest } = data
    return rest
  }
  return {
    ...data,
    _cache: cache,
    _timings: cache === 'hit' ? { total_ms: Math.round(performance.now() - t0), cache_hit: true } : marks,
    _cache_key: cacheKey,
  }
}

export { invalidateClinicDashboard, invalidateDashboardRelatedCaches, dashboardCacheKey, scopeKeyForProfile }
