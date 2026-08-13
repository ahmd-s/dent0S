/**
 * Dental Flow Engine — central appointment lifecycle actions (Sprint 13).
 * All actions update appointment records, chair state, and Activity Engine.
 */

import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import { canTransition, normalizeStatus, FLOW_COLUMN_STATUS } from '@/lib/appointment-status'
import { isChairAssignable, normalizeChairStatus } from '@/lib/chair-status'
import { getWaitingMinutes, computeQueueWaitStats } from '@/lib/flow-waiting-timer'
import { findAppointmentConflicts } from '@/lib/appointment-conflicts'
import { applyTreatmentConsumption } from '@/lib/inventory-workflow-engine'

const ACTIVE_CHAIR_STATUSES = [
  'scheduled', 'confirmed', 'checked_in', 'waiting', 'called', 'doctor_ready',
  'in_treatment', 'treatment_paused', 'lab_pending', 'billing', 'arrived', 'in_progress',
]

/** Map flow action → resulting status. */
const ACTION_STATUS = {
  check_in: 'checked_in',
  move_to_waiting: 'waiting',
  move_to_doctor: 'doctor_ready',
  start_treatment: 'in_treatment',
  pause_treatment: 'treatment_paused',
  resume_treatment: 'in_treatment',
  send_to_lab: 'lab_pending',
  receive_from_lab: 'in_treatment',
  billing: 'billing',
  complete: 'completed',
  archive: 'archived',
  cancel: 'cancelled',
  no_show: 'no_show',
}

/** Map status change → activity event. */
const STATUS_EVENT = {
  checked_in: ACTIVITY_EVENTS.APPOINTMENT_CHECKED_IN,
  waiting: ACTIVITY_EVENTS.PATIENT_CHECKED_IN,
  doctor_ready: ACTIVITY_EVENTS.DOCTOR_READY,
  called: ACTIVITY_EVENTS.DOCTOR_READY,
  in_treatment: ACTIVITY_EVENTS.TREATMENT_STARTED,
  treatment_paused: ACTIVITY_EVENTS.TREATMENT_PAUSED,
  lab_pending: ACTIVITY_EVENTS.LAB_SENT,
  billing: ACTIVITY_EVENTS.BILLING_STARTED,
  completed: ACTIVITY_EVENTS.VISIT_COMPLETED,
  archived: ACTIVITY_EVENTS.APPOINTMENT_COMPLETED,
  cancelled: ACTIVITY_EVENTS.APPOINTMENT_CANCELLED,
  no_show: ACTIVITY_EVENTS.NO_SHOW,
}

async function getAppointment(db, clinicId, id) {
  return db.collection('appointments').findOne({ id, clinic_id: clinicId })
}

async function getChair(db, clinicId, chairId) {
  if (!chairId) return null
  return db.collection('clinic_chairs').findOne({ id: chairId, clinic_id: clinicId })
}

async function setChairStatus(db, clinicId, chairId, status, extra = {}) {
  if (!chairId) return
  const now = new Date()
  const update = { status: normalizeChairStatus(status), ...extra }
  if (status === 'occupied') update.occupied_at = now
  if (status === 'cleaning') update.cleaning_started_at = now
  if (status === 'available') {
    update.last_released_at = now
    update.current_appointment_id = null
  }
  await db.collection('clinic_chairs').updateOne(
    { id: chairId, clinic_id: clinicId },
    { $set: update }
  )
}

async function logFlowEvent(db, profile, event, { patientId, appointmentId, metadata = {} }) {
  await logActivity(db, profile, event, { patientId, appointmentId, metadata })
}

async function applyStatusChange(db, profile, existing, newStatus, extra = {}) {
  const now = new Date()
  const normalized = normalizeStatus(newStatus)
  const update = { status: normalized, ...extra }

  if (normalized === 'checked_in' && !existing.checked_in_at) {
    update.checked_in_at = now
    update.waiting_since = now
  }
  if (normalized === 'waiting' && !existing.waiting_since) update.waiting_since = now
  if (normalized === 'doctor_ready') update.doctor_ready_at = now
  if (normalized === 'in_treatment' && !existing.treatment_started_at) update.treatment_started_at = now
  if (normalized === 'treatment_paused') update.treatment_paused_at = now
  if (normalized === 'lab_pending') update.lab_sent_at = now
  if (normalized === 'billing') update.billing_started_at = now
  if (normalized === 'completed') update.completed_at = now
  if (normalized === 'archived') update.archived_at = now

  await db.collection('appointments').updateOne(
    { id: existing.id, clinic_id: existing.clinic_id },
    { $set: update }
  )

  const event = STATUS_EVENT[normalized]
  if (event) {
    const meta = { from_status: existing.status, to_status: normalized }
    if (normalized === 'doctor_ready') {
      meta.wait_minutes = getWaitingMinutes({ ...existing, ...update })
    }
    if (normalized === 'completed' && existing.treatment_started_at) {
      meta.duration_minutes = Math.round((now - new Date(existing.treatment_started_at)) / 60000)
    }
    await logFlowEvent(db, profile, event, {
      patientId: existing.patient_id,
      appointmentId: existing.id,
      metadata: meta,
    })
  }

  if (normalized === 'in_treatment' && existing.status === 'treatment_paused') {
    await logFlowEvent(db, profile, ACTIVITY_EVENTS.TREATMENT_RESUMED, {
      patientId: existing.patient_id,
      appointmentId: existing.id,
      metadata: { from_status: 'treatment_paused' },
    })
  }

  return { ...existing, ...update }
}

async function assignChairToAppointment(db, profile, existing, chairId, isChange = false) {
  const chair = await getChair(db, existing.clinic_id, chairId)
  if (!chair) throw new FlowError('Chair not found', 404)
  if (!isChairAssignable(chair.status)) throw new FlowError('Chair is not available', 409)

  const conflict = await db.collection('appointments').findOne({
    clinic_id: existing.clinic_id,
    chair_id: chairId,
    appointment_date: existing.appointment_date,
    id: { $ne: existing.id },
    status: { $in: ACTIVE_CHAIR_STATUSES },
  })
  if (conflict) throw new FlowError('Chair already assigned to another patient', 409)

  const now = new Date()
  const update = { chair_id: chairId, chair_assigned_at: now }

  if (existing.chair_id && existing.chair_id !== chairId) {
    await setChairStatus(db, existing.clinic_id, existing.chair_id, 'cleaning', {
      cleaning_started_at: now,
      current_appointment_id: null,
    })
    await logFlowEvent(db, profile, ACTIVITY_EVENTS.CHAIR_CHANGED, {
      patientId: existing.patient_id,
      appointmentId: existing.id,
      metadata: { from_chair: existing.chair_id, to_chair: chairId },
    })
  } else if (!existing.chair_id) {
    await logFlowEvent(db, profile, ACTIVITY_EVENTS.CHAIR_ASSIGNED, {
      patientId: existing.patient_id,
      appointmentId: existing.id,
      metadata: { chair_id: chairId, chair_name: chair.name },
    })
  }

  await db.collection('appointments').updateOne(
    { id: existing.id, clinic_id: existing.clinic_id },
    { $set: update }
  )

  await setChairStatus(db, existing.clinic_id, chairId, 'occupied', {
    current_appointment_id: existing.id,
    assigned_at: now,
  })

  return { ...existing, ...update }
}

export class FlowError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

/**
 * Execute a flow action on an appointment.
 * @returns {Promise<object>} Updated appointment fields
 */
export async function executeFlowAction(db, profile, appointmentId, action, payload = {}) {
  const cid = profile.clinic_id
  const existing = await getAppointment(db, cid, appointmentId)
  if (!existing) throw new FlowError('Appointment not found', 404)

  switch (action) {
    case 'check_in': {
      const status = ACTION_STATUS.check_in
      if (!canTransition(existing.status, status)) throw new FlowError(`Cannot check in from ${existing.status}`)
      return applyStatusChange(db, profile, existing, status)
    }

    case 'move_to_waiting':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.move_to_waiting)

    case 'move_to_doctor':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.move_to_doctor)

    case 'assign_chair':
    case 'change_chair': {
      if (!payload.chair_id) throw new FlowError('chair_id required')
      const updated = await assignChairToAppointment(db, profile, existing, payload.chair_id, action === 'change_chair')
      if (payload.status) await applyStatusChange(db, profile, updated, payload.status)
      return updated
    }

    case 'release_chair': {
      if (!existing.chair_id) throw new FlowError('No chair assigned')
      const chairId = existing.chair_id
      await db.collection('appointments').updateOne(
        { id: existing.id, clinic_id: cid },
        { $set: { chair_id: null, chair_released_at: new Date() } }
      )
      await setChairStatus(db, cid, chairId, 'cleaning', { current_appointment_id: null })
      await logFlowEvent(db, profile, ACTIVITY_EVENTS.CHAIR_RELEASED, {
        patientId: existing.patient_id,
        appointmentId: existing.id,
        metadata: { chair_id: chairId },
      })
      return { ...existing, chair_id: null }
    }

    case 'start_treatment':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.start_treatment)

    case 'pause_treatment':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.pause_treatment)

    case 'resume_treatment':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.resume_treatment)

    case 'send_to_lab':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.send_to_lab)

    case 'receive_from_lab':
      await logFlowEvent(db, profile, ACTIVITY_EVENTS.LAB_RECEIVED, {
        patientId: existing.patient_id,
        appointmentId: existing.id,
      })
      return applyStatusChange(db, profile, existing, ACTION_STATUS.receive_from_lab)

    case 'billing':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.billing)

    case 'complete':
      if (existing.chair_id) {
        await setChairStatus(db, cid, existing.chair_id, 'cleaning', { current_appointment_id: null })
      }
      {
        const result = await applyStatusChange(db, profile, existing, ACTION_STATUS.complete)
        try {
          const visit = await db.collection('visits').findOne({ appointment_id: existing.id, clinic_id: cid })
          const treatmentName = visit?.treatment_done || existing.treatment_type || existing.reason
          if (treatmentName && visit) {
            await applyTreatmentConsumption(db, profile, {
              treatment_name: treatmentName,
              visit_id: visit.id,
              patient_id: existing.patient_id,
              patient_name: existing.patient_name_temp || visit.patient_name,
              appointment_id: existing.id,
            })
          }
        } catch (e) {
          console.error('Auto inventory consumption on complete:', e)
        }
        return result
      }

    case 'archive':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.archive)

    case 'cancel':
      if (existing.chair_id) {
        await setChairStatus(db, cid, existing.chair_id, 'available', { current_appointment_id: null })
      }
      return applyStatusChange(db, profile, existing, ACTION_STATUS.cancel)

    case 'no_show':
      return applyStatusChange(db, profile, existing, ACTION_STATUS.no_show)

    case 'reschedule': {
      const { appointment_date, appointment_time } = payload
      if (!appointment_date && !appointment_time) throw new FlowError('Date or time required')
      const nextDate = appointment_date || existing.appointment_date
      const nextTime = appointment_time || existing.appointment_time
      const { hasConflict, conflicts } = await findAppointmentConflicts(db, {
        clinicId: cid,
        doctorId: existing.doctor_id,
        chairId: existing.chair_id,
        appointmentDate: nextDate,
        appointmentTime: nextTime,
        durationMinutes: existing.duration_minutes || 30,
        excludeId: existing.id,
      })
      if (hasConflict) throw new FlowError(conflicts[0]?.message || 'Scheduling conflict', 409)
      const update = { appointment_date: nextDate, appointment_time: nextTime }
      await db.collection('appointments').updateOne({ id: existing.id, clinic_id: cid }, { $set: update })
      await logFlowEvent(db, profile, ACTIVITY_EVENTS.APPOINTMENT_RESCHEDULED, {
        patientId: existing.patient_id,
        appointmentId: existing.id,
        metadata: {
          from_date: existing.appointment_date,
          from_time: existing.appointment_time,
          to_date: nextDate,
          to_time: nextTime,
        },
      })
      return { ...existing, ...update }
    }

    case 'move_column': {
      const col = payload.column
      const status = FLOW_COLUMN_STATUS[col]
      if (!status) throw new FlowError('Invalid column')
      if (!canTransition(existing.status, status)) throw new FlowError(`Cannot move to ${status}`)
      return applyStatusChange(db, profile, existing, status)
    }

    default:
      throw new FlowError(`Unknown action: ${action}`)
  }
}

/** Build chair board data for a clinic on a given date. */
export async function buildChairBoard(db, clinicId, date) {
  const chairs = await db.collection('clinic_chairs')
    .find({ clinic_id: clinicId, is_active: { $ne: false } })
    .sort({ sort_order: 1, name: 1 })
    .toArray()

  const appts = await db.collection('appointments').find({
    clinic_id: clinicId,
    appointment_date: date,
    chair_id: { $ne: null },
    status: { $in: ACTIVE_CHAIR_STATUSES },
  }).toArray()

  const apptByChair = Object.fromEntries(appts.map(a => [a.chair_id, a]))
  const pids = [...new Set(appts.map(a => a.patient_id).filter(Boolean))]
  const dids = [...new Set(appts.map(a => a.doctor_id).filter(Boolean))]
  const [pts, docs] = await Promise.all([
    pids.length ? db.collection('patients').find({ id: { $in: pids }, clinic_id: clinicId }).toArray() : [],
    dids.length ? db.collection('profiles').find({ id: { $in: dids }, clinic_id: clinicId }).toArray() : [],
  ])
  const pmap = Object.fromEntries(pts.map(p => [p.id, p]))
  const dmap = Object.fromEntries(docs.map(d => [d.id, d.full_name]))

  return chairs.map(chair => {
    const appt = apptByChair[chair.id]
    const pt = appt?.patient_id ? pmap[appt.patient_id] : null
    const status = normalizeChairStatus(chair.status || (appt ? 'occupied' : 'available'))
    const occupiedMinutes = appt?.treatment_started_at
      ? Math.round((Date.now() - new Date(appt.treatment_started_at)) / 60000)
      : appt?.chair_assigned_at
        ? Math.round((Date.now() - new Date(appt.chair_assigned_at)) / 60000)
        : 0

    return {
      id: chair.id,
      name: chair.name,
      color: chair.color,
      status,
      assigned_at: chair.assigned_at || appt?.chair_assigned_at || null,
      treatment_started_at: appt?.treatment_started_at || null,
      treatment_finished_at: appt?.completed_at || null,
      cleaning_started_at: chair.cleaning_started_at || null,
      cleaning_finished_at: chair.cleaning_finished_at || null,
      occupied_minutes: occupiedMinutes,
      appointment: appt ? {
        id: appt.id,
        status: normalizeStatus(appt.status),
        patient_name: pt?.name || appt.patient_name_temp,
        patient_id: appt.patient_id,
        doctor_name: dmap[appt.doctor_id] || '',
        chief_complaint: appt.chief_complaint,
        appointment_type: appt.appointment_type,
      } : null,
    }
  })
}

/** Pure metrics from already-loaded appointments + chairs (avoids re-query on dashboard). */
export function computeFlowMetricsFromAppointments(appts, chairs = [], now = new Date()) {
  const waitStats = computeQueueWaitStats(appts, now)

  const inTreatment = appts.filter(a => normalizeStatus(a.status) === 'in_treatment').length
  const completed = appts.filter(a => ['completed', 'archived'].includes(normalizeStatus(a.status))).length
  const cancelled = appts.filter(a => normalizeStatus(a.status) === 'cancelled').length
  const noShow = appts.filter(a => normalizeStatus(a.status) === 'no_show').length
  const emergency = appts.filter(a => a.priority === 'emergency' || a.appointment_type === 'emergency').length

  const doctorLoads = {}
  for (const a of appts) {
    if (!a.doctor_id) continue
    if (!doctorLoads[a.doctor_id]) doctorLoads[a.doctor_id] = { active: 0, completed: 0, waiting: 0 }
    const s = normalizeStatus(a.status)
    if (['waiting', 'checked_in', 'doctor_ready'].includes(s)) doctorLoads[a.doctor_id].waiting++
    else if (s === 'in_treatment') doctorLoads[a.doctor_id].active++
    else if (s === 'completed') doctorLoads[a.doctor_id].completed++
  }

  const occupiedChairs = chairs.filter(c => normalizeChairStatus(c.status) === 'occupied').length
  const chairUtilization = chairs.length ? Math.round((occupiedChairs / chairs.length) * 100) : 0

  const treatmentDurations = appts
    .filter(a => a.treatment_started_at && a.completed_at)
    .map(a => Math.round((new Date(a.completed_at) - new Date(a.treatment_started_at)) / 60000))
  const avgTreatment = treatmentDurations.length
    ? Math.round(treatmentDurations.reduce((s, d) => s + d, 0) / treatmentDurations.length)
    : null

  return {
    appointments_today: appts.length,
    waiting_count: waitStats.count,
    average_wait_minutes: waitStats.average,
    longest_wait_minutes: waitStats.longest,
    in_treatment: inTreatment,
    completed_today: completed,
    cancelled_today: cancelled,
    no_shows_today: noShow,
    emergency_queue: emergency,
    chair_utilization_pct: chairUtilization,
    average_treatment_minutes: avgTreatment,
    doctor_loads: doctorLoads,
    queue_health: waitStats.longest <= 30 ? 'good' : waitStats.longest <= 60 ? 'moderate' : 'critical',
  }
}

export async function computeFlowMetrics(db, clinicId, date, doctorFilter = {}) {
  const filter = { clinic_id: clinicId, appointment_date: date, ...doctorFilter }
  const [appts, chairs] = await Promise.all([
    db.collection('appointments').find(filter).toArray(),
    db.collection('clinic_chairs').find({ clinic_id: clinicId, is_active: { $ne: false } }).toArray(),
  ])
  return computeFlowMetricsFromAppointments(appts, chairs)
}
