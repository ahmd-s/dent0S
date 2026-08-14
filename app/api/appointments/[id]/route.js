import { requireUser, json, err } from '@/lib/api-helpers'
import { findAppointmentConflicts } from '@/lib/appointment-conflicts'
import { enrichAppointments } from '@/lib/appointment-enrichment'
import { logAppointmentChanges } from '@/lib/appointment-activity'
import { canTransition, normalizeStatus } from '@/lib/appointment-status'
import { onAppointmentConfirmed, scheduleAppointmentReminders, cancelUnsentAppointmentMessages } from '@/lib/communication'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const existing = await ctx.db.collection('appointments').findOne({
    id: params.id,
    clinic_id: ctx.profile.clinic_id,
  })
  if (!existing) return err('Not found', 404)

  const [enriched] = await enrichAppointments(ctx.db, ctx.profile.clinic_id, [existing])
  return json({ appointment: enriched })
}

export async function PUT(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const { profile, db } = ctx
  const cid = profile.clinic_id
  const id = params.id
  const b = await request.json()

  const existing = await db.collection('appointments').findOne({ id, clinic_id: cid })
  if (!existing) return err('Not found', 404)

  const allowed = [
    'status', 'appointment_date', 'appointment_time', 'chief_complaint', 'notes',
    'appointment_type', 'doctor_id', 'duration_minutes', 'chair_id', 'patient_id',
    'priority', 'queue_position',
  ]
  const update = {}
  for (const k of allowed) if (k in b) update[k] = b[k]

  if (update.status) {
    update.status = normalizeStatus(update.status)
    if (!canTransition(existing.status, update.status) && !b.force) {
      return err(`Invalid status transition from ${existing.status} to ${update.status}`, 400)
    }
    if (update.status === 'checked_in' && !existing.checked_in_at) {
      update.checked_in_at = new Date()
    }
  }

  const nextDate = update.appointment_date || existing.appointment_date
  const nextTime = update.appointment_time || existing.appointment_time
  const nextDoctor = update.doctor_id || existing.doctor_id
  const nextChair = update.chair_id !== undefined ? update.chair_id : existing.chair_id
  const nextDuration = update.duration_minutes || existing.duration_minutes || 30

  if (update.appointment_date || update.appointment_time || update.doctor_id || update.chair_id !== undefined || update.duration_minutes) {
    const { hasConflict, conflicts } = await findAppointmentConflicts(db, {
      clinicId: cid,
      doctorId: nextDoctor,
      chairId: nextChair,
      appointmentDate: nextDate,
      appointmentTime: nextTime,
      durationMinutes: nextDuration,
      excludeId: id,
    })
    if (hasConflict && !b.force) {
      return json({
        success: false,
        message: conflicts[0]?.message || 'Scheduling conflict',
        conflicts,
      }, 409)
    }
  }

  if (Object.keys(update).length) {
    await db.collection('appointments').updateOne({ id, clinic_id: cid }, { $set: update })
    await logAppointmentChanges(db, profile, existing, update)

    const merged = { ...existing, ...update }
    const rescheduled = Boolean(update.appointment_date || update.appointment_time)
    if (rescheduled) {
      await cancelUnsentAppointmentMessages(db, profile, id)
    }
    // Awaited so the queued messages survive the response returning.
    if (update.status === 'confirmed' && existing.status !== 'confirmed') {
      await onAppointmentConfirmed(db, profile, merged)
        .catch(e => console.error('Communication hook error:', e))
    } else if (rescheduled) {
      await scheduleAppointmentReminders(db, profile, merged)
        .catch(e => console.error('Communication hook error:', e))
    }
  }

  const { invalidateDashboardRelatedCaches } = await import('@/lib/dashboard-invalidation')
  invalidateDashboardRelatedCaches(cid, 'appointment')

  return json({ ok: true })
}

export async function DELETE(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const existing = await ctx.db.collection('appointments').findOne({
    id: params.id,
    clinic_id: ctx.profile.clinic_id,
  })
  if (!existing) return err('Not found', 404)

  await ctx.db.collection('appointments').updateOne(
    { id: params.id, clinic_id: ctx.profile.clinic_id },
    { $set: { status: 'cancelled' } }
  )
  await logAppointmentChanges(ctx.db, ctx.profile, existing, { status: 'cancelled' })
  const { invalidateDashboardRelatedCaches } = await import('@/lib/dashboard-invalidation')
  invalidateDashboardRelatedCaches(ctx.profile.clinic_id, 'appointment')
  return json({ ok: true })
}
