import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/reports/appointments
 * Appointment analytics derived from activity_events — no repeated appointment scans.
 */
export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 365)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const cid = ctx.profile.clinic_id

  const events = await ctx.db.collection('activity_events').find({
    clinic_id: cid,
    module: 'appointments',
    created_at: { $gte: since },
  }).toArray()

  const counts = {}
  for (const e of events) {
    counts[e.event] = (counts[e.event] || 0) + 1
  }

  const created = counts[ACTIVITY_EVENTS.APPOINTMENT_CREATED] || 0
  const completed = counts[ACTIVITY_EVENTS.APPOINTMENT_COMPLETED] || 0
  const cancelled = counts[ACTIVITY_EVENTS.APPOINTMENT_CANCELLED] || 0
  const noShow = counts[ACTIVITY_EVENTS.APPOINTMENT_NO_SHOW] || 0
  const rescheduled = counts[ACTIVITY_EVENTS.APPOINTMENT_RESCHEDULED] || 0
  const checkedIn = counts[ACTIVITY_EVENTS.PATIENT_CHECKED_IN] || 0

  const totalScheduled = created + rescheduled
  const noShowRate = totalScheduled ? Math.round((noShow / totalScheduled) * 1000) / 10 : 0
  const cancellationRate = totalScheduled ? Math.round((cancelled / totalScheduled) * 1000) / 10 : 0
  const rescheduleRate = totalScheduled ? Math.round((rescheduled / totalScheduled) * 1000) / 10 : 0
  const completionRate = checkedIn ? Math.round((completed / checkedIn) * 1000) / 10 : 0

  const waitTimes = events
    .filter(e => e.event === ACTIVITY_EVENTS.APPOINTMENT_CALLED && e.metadata?.wait_minutes != null)
    .map(e => e.metadata.wait_minutes)
  const avgWait = waitTimes.length
    ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
    : null

  const hourBuckets = {}
  for (const e of events.filter(ev => ev.event === ACTIVITY_EVENTS.APPOINTMENT_CREATED)) {
    const h = new Date(e.created_at).getHours()
    hourBuckets[h] = (hourBuckets[h] || 0) + 1
  }
  const peakHour = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0]

  const chairChanges = counts[ACTIVITY_EVENTS.APPOINTMENT_CHAIR_CHANGED] || 0
  const doctorChanges = counts[ACTIVITY_EVENTS.APPOINTMENT_DOCTOR_CHANGED] || 0

  const durationEvents = events.filter(e =>
    e.event === ACTIVITY_EVENTS.APPOINTMENT_COMPLETED && e.metadata?.duration_minutes != null
  )
  const avgDuration = durationEvents.length
    ? Math.round(durationEvents.reduce((s, e) => s + e.metadata.duration_minutes, 0) / durationEvents.length)
    : null

  return json({
    ok: true,
    days,
    metrics: {
      appointments_booked: created,
      appointments_completed: completed,
      no_show_count: noShow,
      no_show_rate_pct: noShowRate,
      cancellation_rate_pct: cancellationRate,
      reschedule_rate_pct: rescheduleRate,
      completion_rate_pct: completionRate,
      average_wait_minutes: avgWait,
      average_duration_minutes: avgDuration,
      peak_hour: peakHour ? { hour: parseInt(peakHour[0], 10), count: peakHour[1] } : null,
      chair_changes: chairChanges,
      doctor_changes: doctorChanges,
      queue_reorders: counts[ACTIVITY_EVENTS.QUEUE_POSITION_CHANGED] || 0,
    },
    event_counts: counts,
  })
}
