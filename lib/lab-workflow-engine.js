/**
 * Lab Workflow Engine — central lab case lifecycle actions (Sprint 14).
 */

import { v4 as uuidv4 } from 'uuid'
import { logAudit, AUDIT_ACTIONS, AUDIT_SOURCE } from '@/lib/audit'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import {
  canLabTransition,
  normalizeLabStatus,
  safeIsoDate,
  todayIso,
  isOverdue,
  CLOSED_STATUSES,
  LAB_CASE_OPEN_STATUSES,
} from '@/lib/lab-case-helpers'
import { logLabStatusChange, logLabFieldChange } from '@/lib/lab-activity'

const ACTION_STATUS = {
  impression_ready: 'impression_ready',
  send_to_lab: 'sent',
  mark_received: 'lab_received',
  start_manufacturing: 'in_production',
  start_qc: 'quality_check',
  mark_ready: 'ready',
  mark_delivered: 'delivered',
  mark_installed: 'installed',
  complete: 'completed',
  cancel: 'cancelled',
}

const STATUS_TIMESTAMP = {
  impression_ready: 'impression_ready_at',
  sent: 'sent_at',
  lab_received: 'lab_received_at',
  in_production: 'manufacturing_started_at',
  quality_check: 'qc_started_at',
  ready: 'ready_at',
  delivered: 'actual_delivery_date',
  installed: 'installation_date',
  completed: 'completed_at',
}

export class LabFlowError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

async function getCase(db, clinicId, id) {
  return db.collection('lab_cases').findOne({ id, clinic_id: clinicId })
}

async function applyStatusChange(db, profile, existing, newStatus, { note = '', source = AUDIT_SOURCE.CLINIC } = {}) {
  const normalized = normalizeLabStatus(newStatus)
  if (!canLabTransition(existing.status, normalized)) {
    throw new LabFlowError(`Cannot transition from ${existing.status} to ${normalized}`)
  }

  const now = new Date()
  const update = { status: normalized, updated_at: now }
  const tsField = STATUS_TIMESTAMP[normalized]
  if (tsField) update[tsField] = now

  if (normalized === 'impression_ready') update.impression_received_at = now
  if (normalized === 'delivered') {
    update.delivered_by = profile.full_name || profile.id
    if (!existing.actual_delivery_date) update.actual_delivery_date = todayIso()
  }
  if (normalized === 'installed') {
    update.received_by = profile.full_name || profile.id
    update.installation_date = now
  }

  await db.collection('lab_cases').updateOne(
    { id: existing.id, clinic_id: existing.clinic_id },
    {
      $set: update,
      $push: {
        timeline: {
          status: normalized,
          note,
          by: profile.id,
          by_name: profile.full_name || '',
          source,
          at: now,
        },
      },
    }
  )

  await logAudit(db, {
    clinicId: existing.clinic_id,
    labCaseId: existing.id,
    caseNumber: existing.case_number,
    action: AUDIT_ACTIONS.STATUS_UPDATED,
    source,
    actorId: profile.id,
    actorName: profile.full_name || '',
    meta: { status: normalized, note },
  })

  await logLabStatusChange(db, profile, existing, normalized, { note })

  return { ...existing, ...update }
}

/** Add STL file with version history. */
export async function addStlFile(db, profile, labCase, fileMeta) {
  const now = new Date()
  const entry = {
    id: uuidv4(),
    file_name: fileMeta.file_name,
    file_url: fileMeta.file_url,
    file_size: fileMeta.file_size || 0,
    uploaded_by: profile?.id || 'public',
    uploaded_by_name: profile?.full_name || fileMeta.uploaded_by_name || 'External',
    uploaded_at: now,
    version: (labCase.stl_files?.length || 0) + 1,
    is_current: true,
  }

  const prevFiles = (labCase.stl_files || []).map(f => ({ ...f, is_current: false }))
  const stl_files = [...prevFiles, entry]

  await db.collection('lab_cases').updateOne(
    { id: labCase.id },
    {
      $set: {
        stl_files,
        stl_file_url: entry.file_url,
        updated_at: now,
      },
    }
  )

  if (profile?.clinic_id) {
    const isReplace = prevFiles.length > 0
    await logLabFieldChange(db, profile, labCase, isReplace ? ACTIVITY_EVENTS.STL_REPLACED : ACTIVITY_EVENTS.STL_UPLOADED, {
      file_name: entry.file_name,
      version: entry.version,
      file_size: entry.file_size,
    })
  }

  return entry
}

/**
 * Execute a lab workflow action.
 */
export async function executeLabFlowAction(db, profile, caseId, action, payload = {}) {
  const cid = profile.clinic_id
  const existing = await getCase(db, cid, caseId)
  if (!existing) throw new LabFlowError('Lab case not found', 404)

  switch (action) {
    case 'impression_ready':
    case 'send_to_lab':
    case 'mark_received':
    case 'start_manufacturing':
    case 'start_qc':
    case 'mark_ready':
    case 'mark_delivered':
    case 'mark_installed':
    case 'complete':
    case 'cancel': {
      const status = ACTION_STATUS[action]
      return applyStatusChange(db, profile, existing, status, { note: payload.note || '' })
    }

    case 'mark_delayed': {
      const update = {
        is_delayed: true,
        delay_reason: payload.delay_reason || '',
        updated_at: new Date(),
      }
      await db.collection('lab_cases').updateOne({ id: caseId, clinic_id: cid }, { $set: update })
      await logLabFieldChange(db, profile, existing, ACTIVITY_EVENTS.DELIVERY_DELAYED, {
        delay_reason: payload.delay_reason,
        expected_delivery_date: existing.expected_delivery_date,
      })
      return { ...existing, ...update }
    }

    case 'change_vendor': {
      if (!payload.vendor_id) throw new LabFlowError('vendor_id required')
      const vendor = await db.collection('vendors').findOne({ id: payload.vendor_id, clinic_id: cid })
      if (!vendor) throw new LabFlowError('Vendor not found', 404)
      await db.collection('lab_cases').updateOne(
        { id: caseId, clinic_id: cid },
        { $set: { vendor_id: payload.vendor_id, updated_at: new Date() } }
      )
      await logLabFieldChange(db, profile, existing, ACTIVITY_EVENTS.VENDOR_CHANGED, {
        from_vendor: existing.vendor_id,
        to_vendor: payload.vendor_id,
      })
      return { ...existing, vendor_id: payload.vendor_id }
    }

    case 'update_delivery': {
      const update = { updated_at: new Date() }
      if ('expected_delivery_date' in payload) update.expected_delivery_date = safeIsoDate(payload.expected_delivery_date)
      if ('estimated_completion_date' in payload) update.estimated_completion_date = safeIsoDate(payload.estimated_completion_date)
      if ('actual_delivery_date' in payload) update.actual_delivery_date = safeIsoDate(payload.actual_delivery_date)
      if ('installation_date' in payload) update.installation_date = payload.installation_date ? new Date(payload.installation_date) : null
      await db.collection('lab_cases').updateOne({ id: caseId, clinic_id: cid }, { $set: update })
      await logLabFieldChange(db, profile, existing, ACTIVITY_EVENTS.LAB_UPDATED, update)
      return { ...existing, ...update }
    }

    default:
      throw new LabFlowError(`Unknown action: ${action}`)
  }
}

/** Compute lab metrics for dashboards/reports. */
export async function computeLabMetrics(db, clinicId, filters = {}) {
  const f = { clinic_id: clinicId, ...filters }
  const cases = await db.collection('lab_cases').find(f).toArray()
  const today = todayIso()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const open = cases.filter(c => LAB_CASE_OPEN_STATUSES.includes(normalizeLabStatus(c.status)))
  const dueToday = open.filter(c => safeIsoDate(c.expected_delivery_date) === today)
  const delayed = open.filter(c => isOverdue(c) || c.is_delayed)
  const awaitingDispatch = cases.filter(c => normalizeLabStatus(c.status) === 'ready')
  const awaitingInstall = cases.filter(c => ['delivered', 'received'].includes(normalizeLabStatus(c.status)))
  const completedWeek = cases.filter(c =>
    normalizeLabStatus(c.status) === 'completed' &&
    c.completed_at && new Date(c.completed_at) >= weekAgo
  )

  const turnaroundDays = cases
    .filter(c => c.sent_at && c.actual_delivery_date)
    .map(c => Math.round((new Date(c.actual_delivery_date) - new Date(c.sent_at)) / 86400000))
  const avgTurnaround = turnaroundDays.length
    ? Math.round(turnaroundDays.reduce((s, d) => s + d, 0) / turnaroundDays.length)
    : null

  const vendorStats = {}
  for (const c of cases) {
    if (!c.vendor_id) continue
    if (!vendorStats[c.vendor_id]) vendorStats[c.vendor_id] = { active: 0, completed: 0, delayed: 0, total: 0 }
    vendorStats[c.vendor_id].total++
    const s = normalizeLabStatus(c.status)
    if (CLOSED_STATUSES.includes(s)) vendorStats[c.vendor_id].completed++
    else vendorStats[c.vendor_id].active++
    if (isOverdue(c) || c.is_delayed) vendorStats[c.vendor_id].delayed++
  }

  return {
    open_cases: open.length,
    due_today: dueToday.length,
    delayed_cases: delayed.length,
    awaiting_dispatch: awaitingDispatch.length,
    awaiting_installation: awaitingInstall.length,
    completed_this_week: completedWeek.length,
    average_turnaround_days: avgTurnaround,
    delay_percentage: open.length ? Math.round((delayed.length / open.length) * 100) : 0,
    vendor_stats: vendorStats,
    total_cases: cases.length,
  }
}

/** Build vendor dashboard data. */
export async function buildVendorDashboard(db, clinicId, vendorId) {
  const vendor = await db.collection('vendors').findOne({ id: vendorId, clinic_id: clinicId })
  if (!vendor) return null

  const cases = await db.collection('lab_cases').find({ clinic_id: clinicId, vendor_id: vendorId }).toArray()
  const open = cases.filter(c => !CLOSED_STATUSES.includes(normalizeLabStatus(c.status)))
  const completed = cases.filter(c => normalizeLabStatus(c.status) === 'completed')
  const delayed = open.filter(c => isOverdue(c) || c.is_delayed)

  const turnaroundDays = cases
    .filter(c => c.sent_at && c.actual_delivery_date)
    .map(c => Math.round((new Date(c.actual_delivery_date) - new Date(c.sent_at)) / 86400000))
  const avgTurnaround = turnaroundDays.length
    ? Math.round(turnaroundDays.reduce((s, d) => s + d, 0) / turnaroundDays.length)
    : null

  const today = todayIso()
  const todayWorkload = open.filter(c => safeIsoDate(c.expected_delivery_date) === today)

  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      contact_person: vendor.contact_person,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      services: vendor.material_types || '',
      average_turnaround: avgTurnaround,
      rating: vendor.rating || null,
      active_cases: open.length,
      completed_cases: completed.length,
      delayed_cases: delayed.length,
    },
    today_workload: todayWorkload.length,
    pending_deliveries: open.filter(c => ['ready', 'in_production', 'quality_check'].includes(normalizeLabStatus(c.status))).length,
    average_completion_days: avgTurnaround,
  }
}
