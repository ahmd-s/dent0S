/**
 * Log appointment mutations to the Activity Engine.
 */

import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import { normalizeStatus } from '@/lib/appointment-status'

export async function logAppointmentChanges(db, profile, existing, update) {
  const id = existing.id
  const patientId = existing.patient_id

  if (update.status && normalizeStatus(update.status) !== normalizeStatus(existing.status)) {
    const s = normalizeStatus(update.status)
    const eventMap = {
      confirmed: ACTIVITY_EVENTS.APPOINTMENT_CONFIRMED,
      checked_in: ACTIVITY_EVENTS.PATIENT_CHECKED_IN,
      waiting: ACTIVITY_EVENTS.PATIENT_CHECKED_IN,
      called: ACTIVITY_EVENTS.APPOINTMENT_CALLED,
      in_treatment: ACTIVITY_EVENTS.VISIT_STARTED,
      completed: ACTIVITY_EVENTS.APPOINTMENT_COMPLETED,
      cancelled: ACTIVITY_EVENTS.APPOINTMENT_CANCELLED,
      no_show: ACTIVITY_EVENTS.APPOINTMENT_NO_SHOW,
    }
    const event = eventMap[s]
    if (event) {
      await logActivity(db, profile, event, {
        patientId,
        appointmentId: id,
        metadata: { from_status: existing.status, to_status: s },
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
    await logActivity(db, profile, ACTIVITY_EVENTS.APPOINTMENT_CHAIR_CHANGED, {
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
