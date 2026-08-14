import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requireUser, json, err, cors, clean } from '@/lib/api-helpers'
import { sortQueue } from '@/lib/appointment-conflicts'
import { enrichAppointments } from '@/lib/appointment-enrichment'
import { normalizeStatus, isInQueue } from '@/lib/appointment-status'
import { logAppointmentChanges } from '@/lib/appointment-activity'
import { todayIso } from '@/lib/appointment-time'
import { doctorAppointmentFilter } from '@/lib/doctor-scope'
import { getProfileRoles } from '@/lib/profile-roles'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/appointments/queue — today's queue ordered by position.
 * POST /api/appointments/queue — reorder queue or call next patient.
 */
export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const date = url.searchParams.get('date') || todayIso()
  const roles = getProfileRoles(ctx.profile)
  const filter = {
    clinic_id: ctx.profile.clinic_id,
    appointment_date: date,
    ...doctorAppointmentFilter(roles, ctx.profile.id),
  }

  const raw = await ctx.db.collection('appointments').find(filter).toArray()
  const queueItems = raw.filter(a => isInQueue(a.status))
  const sorted = sortQueue(queueItems)
  const enriched = await enrichAppointments(ctx.db, ctx.profile.clinic_id, sorted)
  const allEnriched = await enrichAppointments(ctx.db, ctx.profile.clinic_id, raw)

  const stats = {
    waiting: allEnriched.filter(a => normalizeStatus(a.status) === 'waiting').length,
    called: allEnriched.filter(a => ['called', 'doctor_ready'].includes(normalizeStatus(a.status))).length,
    doctor_ready: allEnriched.filter(a => normalizeStatus(a.status) === 'doctor_ready').length,
    in_treatment: allEnriched.filter(a => normalizeStatus(a.status) === 'in_treatment').length,
    treatment_paused: allEnriched.filter(a => normalizeStatus(a.status) === 'treatment_paused').length,
    lab_pending: allEnriched.filter(a => normalizeStatus(a.status) === 'lab_pending').length,
    billing: allEnriched.filter(a => normalizeStatus(a.status) === 'billing').length,
    checked_in: allEnriched.filter(a => ['checked_in', 'arrived'].includes(a.status)).length,
    scheduled: allEnriched.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length,
    completed: allEnriched.filter(a => a.status === 'completed').length,
    cancelled: allEnriched.filter(a => a.status === 'cancelled').length,
    no_show: allEnriched.filter(a => a.status === 'no_show').length,
  }

  return json({ ok: true, date, queue: enriched, all: allEnriched, stats })
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const body = await request.json()
  const cid = ctx.profile.clinic_id

  if (body.action === 'reorder' && Array.isArray(body.order)) {
    for (let i = 0; i < body.order.length; i++) {
      const id = body.order[i]
      const existing = await ctx.db.collection('appointments').findOne({ id, clinic_id: cid })
      if (!existing) continue
      await ctx.db.collection('appointments').updateOne(
        { id, clinic_id: cid },
        { $set: { queue_position: i + 1 } }
      )
      if (existing.queue_position !== i + 1) {
        await logAppointmentChanges(ctx.db, ctx.profile, existing, { queue_position: i + 1 })
      }
    }
    return json({ ok: true })
  }

  if (body.action === 'call_next') {
    const date = body.date || todayIso()
    const waiting = await ctx.db.collection('appointments').find({
      clinic_id: cid,
      appointment_date: date,
      status: { $in: ['waiting', 'checked_in', 'arrived'] },
    }).sort({ queue_position: 1, checked_in_at: 1 }).limit(1).toArray()

    if (!waiting.length) return err('No patients waiting', 404)
    const next = waiting[0]
    await ctx.db.collection('appointments').updateOne(
      { id: next.id, clinic_id: cid },
      { $set: { status: 'doctor_ready', doctor_ready_at: new Date() } }
    )
    await logAppointmentChanges(ctx.db, ctx.profile, next, { status: 'doctor_ready' })
    return json({ ok: true, appointment: clean({ ...next, status: 'doctor_ready' }) })
  }

  if (body.action === 'walk_in') {
    if (!body.patient_id && !body.patient_name_temp) return err('Patient required')
    const id = uuidv4()
    const date = body.date || todayIso()
    const queueCount = await ctx.db.collection('appointments').countDocuments({
      clinic_id: cid,
      appointment_date: date,
      status: { $in: ['waiting', 'checked_in', 'called', 'arrived'] },
    })

    const doc = {
      id,
      clinic_id: cid,
      patient_id: body.patient_id || null,
      doctor_id: body.doctor_id || ctx.profile.id,
      chair_id: body.chair_id || null,
      patient_name_temp: body.patient_name_temp || '',
      patient_phone_temp: body.patient_phone_temp || '',
      appointment_date: date,
      appointment_time: body.appointment_time || new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
      duration_minutes: body.duration_minutes || 30,
      status: 'waiting',
      appointment_type: body.appointment_type || 'consultation',
      chief_complaint: body.chief_complaint || '',
      notes: body.notes || '',
      booked_via: 'walk_in',
      is_walk_in: true,
      queue_position: queueCount + 1,
      checked_in_at: new Date(),
      priority: body.priority || 'normal',
      created_by: ctx.profile.id,
      created_at: new Date(),
    }

    await ctx.db.collection('appointments').insertOne(doc)
    const { logActivity } = await import('@/lib/activity-helpers')
    const { ACTIVITY_EVENTS } = await import('@/lib/activity-event-registry')
    await logActivity(ctx.db, ctx.profile, ACTIVITY_EVENTS.APPOINTMENT_CREATED, {
      patientId: doc.patient_id,
      appointmentId: id,
      metadata: { walk_in: true, appointment_date: date },
    })
    await logAppointmentChanges(ctx.db, ctx.profile, { ...doc, status: 'scheduled' }, { status: 'waiting' })

    return json({ ok: true, id })
  }

  return err('Unknown action')
}
