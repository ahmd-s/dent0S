/**
 * Log appointment mutations to the Activity Engine.
 */

import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import { normalizeStatus } from '@/lib/appointment-status'
import { getWaitingMinutes } from '@/lib/flow-waiting-timer'

export async function logAppointmentChanges(db, profile, existing, update) {
  const id = existing.id
  const patientId = existing.patient_id

  if (update.status && normalizeStatus(update.status) !== normalizeStatus(existing.status)) {
    const s = normalizeStatus(update.status)
    const eventMap = {
      confirmed: ACTIVITY_EVENTS.APPOINTMENT_CONFIRMED,
      checked_in: ACTIVITY_EVENTS.APPOINTMENT_CHECKED_IN,
      waiting: ACTIVITY_EVENTS.PATIENT_CHECKED_IN,
      called: ACTIVITY_EVENTS.DOCTOR_READY,
      doctor_ready: ACTIVITY_EVENTS.DOCTOR_READY,
      in_treatment: ACTIVITY_EVENTS.TREATMENT_STARTED,
      treatment_paused: ACTIVITY_EVENTS.TREATMENT_PAUSED,
      lab_pending: ACTIVITY_EVENTS.LAB_SENT,
      billing: ACTIVITY_EVENTS.BILLING_STARTED,
      completed: ACTIVITY_EVENTS.VISIT_COMPLETED,
      archived: ACTIVITY_EVENTS.APPOINTMENT_COMPLETED,
      cancelled: ACTIVITY_EVENTS.APPOINTMENT_CANCELLED,
      no_show: ACTIVITY_EVENTS.NO_SHOW,
    }
    const event = eventMap[s]
    if (event) {
      const metadata = { from_status: existing.status, to_status: s }
      if (s === 'doctor_ready' || s === 'called') {
        metadata.wait_minutes = getWaitingMinutes(existing)
      }
      if (s === 'completed' && existing.treatment_started_at) {
        metadata.duration_minutes = Math.round((Date.now() - new Date(existing.treatment_started_at)) / 60000)
      }
      await logActivity(db, profile, event, {
        patientId,
        appointmentId: id,
        metadata,
      })
    }
  }

  const dateChanged = update.appointment_date && update.appointment_date !== existing.appointment_date
  const timeChanged = update.appointment_time && update.appointment_time !== existing.appointment_time
  if (dateChanged || timeChanged) {
    await logActivity(db, profile, ACTIVITY_EVENTS.APPOINTMENT_RESCHEDULED, {
      patientId,
      appointmentId: id,
      metadata: {
        from_date: existing.appointment_date,
        from_time: existing.appointment_time,
        to_date: update.appointment_date || existing.appointment_date,
        to_time: update.appointment_time || existing.appointment_time,
      },
    })
  }

  if (update.chair_id !== undefined && update.chair_id !== existing.chair_id) {
    const event = existing.chair_id
      ? ACTIVITY_EVENTS.CHAIR_CHANGED
      : ACTIVITY_EVENTS.CHAIR_ASSIGNED
    await logActivity(db, profile, event, {
      patientId,
      appointmentId: id,
      metadata: { from_chair: existing.chair_id, to_chair: update.chair_id },
    })
  }

  if (update.doctor_id && update.doctor_id !== existing.doctor_id) {
    await logActivity(db, profile, ACTIVITY_EVENTS.APPOINTMENT_DOCTOR_CHANGED, {
      patientId,
      appointmentId: id,
      metadata: { from_doctor: existing.doctor_id, to_doctor: update.doctor_id },
    })
  }

  if (update.queue_position !== undefined && update.queue_position !== existing.queue_position) {
    await logActivity(db, profile, ACTIVITY_EVENTS.QUEUE_POSITION_CHANGED, {
      patientId,
      appointmentId: id,
      metadata: { from: existing.queue_position, to: update.queue_position },
    })
  }
}
