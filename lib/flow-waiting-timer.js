/**
 * Smart waiting timer calculations — Sprint 13.
 */

import { parseAppointmentTime } from '@/lib/appointment-time'
import { normalizeStatus } from '@/lib/appointment-status'

/** Thresholds in minutes for color indicators. */
export const WAIT_THRESHOLDS = { green: 15, amber: 30 }

export function minutesBetween(from, to = new Date()) {
  if (!from) return 0
  const start = from instanceof Date ? from : new Date(from)
  return Math.max(0, Math.round((to - start) / 60000))
}

/** Current waiting time since check-in for queue appointments. */
export function getWaitingMinutes(appointment, now = new Date()) {
  const status = normalizeStatus(appointment.status)
  if (!['checked_in', 'waiting', 'called', 'doctor_ready'].includes(status)) return 0
  const since = appointment.checked_in_at || appointment.waiting_since
  return minutesBetween(since, now)
}

/** Minutes past scheduled appointment time (late arrival indicator). */
export function getLateArrivalMinutes(appointment, now = new Date()) {
  if (!appointment.appointment_date || !appointment.appointment_time) return 0
  const scheduled = parseAppointmentTime(appointment.appointment_date, appointment.appointment_time)
  if (!scheduled || now <= scheduled) return 0
  return minutesBetween(scheduled, now)
}

/** Treatment duration in minutes for in-treatment appointments. */
export function getTreatmentMinutes(appointment, now = new Date()) {
  const status = normalizeStatus(appointment.status)
  if (!['in_treatment', 'treatment_paused'].includes(status)) return 0
  const since = appointment.treatment_started_at
  return minutesBetween(since, now)
}

export function waitColor(minutes) {
  if (minutes <= WAIT_THRESHOLDS.green) return 'green'
  if (minutes <= WAIT_THRESHOLDS.amber) return 'amber'
  return 'red'
}

export function waitColorClass(color) {
  const map = {
    green: 'text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400',
    red: 'text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400',
  }
  return map[color] || map.green
}

/** Aggregate queue wait stats from enriched appointments. */
export function computeQueueWaitStats(appointments, now = new Date()) {
  const waiting = appointments.filter(a => {
    const s = normalizeStatus(a.status)
    return ['checked_in', 'waiting', 'called', 'doctor_ready'].includes(s)
  })
  const waits = waiting.map(a => getWaitingMinutes(a, now))
  const avg = waits.length ? Math.round(waits.reduce((s, w) => s + w, 0) / waits.length) : 0
  const longest = waits.length ? Math.max(...waits) : 0
  return { count: waiting.length, average: avg, longest, waits }
}

/** Doctor delay: patients waiting beyond threshold while doctor has active treatment. */
export function computeDoctorDelay(appointments, doctorId, now = new Date()) {
  const doctorAppts = appointments.filter(a => a.doctor_id === doctorId)
  const inTreatment = doctorAppts.filter(a => normalizeStatus(a.status) === 'in_treatment')
  const waiting = doctorAppts.filter(a => {
    const s = normalizeStatus(a.status)
    return ['waiting', 'doctor_ready', 'called'].includes(s)
  })
  if (!inTreatment.length || !waiting.length) return 0
  return Math.max(...waiting.map(a => getWaitingMinutes(a, now)))
}
