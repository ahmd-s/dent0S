/**
 * Smart conflict detection for appointments — doctor, chair, duration, block times.
 */

import { parseTimeToMinutes, rangesOverlap } from '@/lib/appointment-time'
import { BLOCKING_STATUSES, normalizeStatus } from '@/lib/appointment-status'

function apptRange(a) {
  const start = parseTimeToMinutes(a.appointment_time)
  if (start == null) return null
  const end = start + (a.duration_minutes || 30)
  return { start, end }
}

export async function findAppointmentConflicts(db, {
  clinicId,
  doctorId,
  chairId,
  appointmentDate,
  appointmentTime,
  durationMinutes = 30,
  excludeId = null,
}) {
  const start = parseTimeToMinutes(appointmentTime)
  if (start == null) return { conflicts: [], warnings: [] }

  const end = start + durationMinutes
  const conflicts = []
  const warnings = []

  const filter = {
    clinic_id: clinicId,
    appointment_date: appointmentDate,
    status: { $in: BLOCKING_STATUSES },
  }
  if (excludeId) filter.id = { $ne: excludeId }

  const existing = await db.collection('appointments').find(filter).toArray()

  for (const a of existing) {
    const range = apptRange(a)
    if (!range) continue
    if (!rangesOverlap(start, end, range.start, range.end)) continue

    if (doctorId && a.doctor_id === doctorId) {
      conflicts.push({
        type: 'doctor',
        message: `Dr. already has an appointment at ${a.appointment_time}`,
        appointment_id: a.id,
      })
    }
    if (chairId && a.chair_id === chairId) {
      conflicts.push({
        type: 'chair',
        message: `Chair is booked at ${a.appointment_time}`,
        appointment_id: a.id,
      })
    }
  }

  if (doctorId) {
    const blocks = await db.collection('block_times').find({
      clinic_id: clinicId,
      doctor_id: doctorId,
      date: appointmentDate,
      is_active: { $ne: false },
    }).toArray()

    for (const b of blocks) {
      const bStart = parseTimeToMinutes(b.start_time?.replace(/^(\d{2}):(\d{2}).*/, '$1:$2'))
      const bEnd = parseTimeToMinutes(b.end_time?.replace(/^(\d{2}):(\d{2}).*/, '$1:$2'))
      if (bStart == null || bEnd == null) continue
      if (rangesOverlap(start, end, bStart, bEnd)) {
        conflicts.push({
          type: 'block_time',
          message: `Doctor blocked: ${b.reason || 'Unavailable'}`,
          block_id: b.id,
        })
      }
    }
  }

  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  const hours = clinic?.operating_hours?.[appointmentDate.slice(0, 3).toLowerCase()] || clinic?.operating_hours?.default
  if (hours?.open && hours?.close) {
    const openMin = parseTimeToMinutes(hours.open)
    const closeMin = parseTimeToMinutes(hours.close)
    if (openMin != null && closeMin != null && (start < openMin || end > closeMin)) {
      warnings.push({
        type: 'outside_hours',
        message: 'Appointment is outside clinic operating hours',
      })
    }
  }

  return { conflicts, warnings, hasConflict: conflicts.length > 0 }
}

export async function checkAppointmentConflict(db, clinicId, doctorId, appointmentDate, appointmentTime, opts = {}) {
  const { conflicts } = await findAppointmentConflicts(db, {
    clinicId,
    doctorId,
    chairId: opts.chairId,
    appointmentDate,
    appointmentTime,
    durationMinutes: opts.durationMinutes || 30,
    excludeId: opts.excludeId,
  })
  return conflicts.length > 0
}

export function sortAppointmentsByTime(appointments) {
  return [...appointments].sort((a, b) => {
    const ta = parseTimeToMinutes(a.appointment_time) ?? 9999
    const tb = parseTimeToMinutes(b.appointment_time) ?? 9999
    return ta - tb
  })
}

export function sortQueue(appointments) {
  return [...appointments].sort((a, b) => {
    const pa = a.queue_position ?? 9999
    const pb = b.queue_position ?? 9999
    if (pa !== pb) return pa - pb
    const ca = a.checked_in_at ? new Date(a.checked_in_at).getTime() : 0
    const cb = b.checked_in_at ? new Date(b.checked_in_at).getTime() : 0
    return ca - cb
  })
}

export { normalizeStatus }
