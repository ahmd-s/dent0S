import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { buildChairBoard } from '@/lib/dental-flow-engine'
import { todayIso } from '@/lib/appointment-time'
import { executeFlowAction, FlowError } from '@/lib/dental-flow-engine'
import { normalizeChairStatus } from '@/lib/chair-status'
import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/chairs/board?date= — chair management board
 * POST /api/chairs/board — chair status actions (release, cleaning complete, out of service)
 */
export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const date = url.searchParams.get('date') || todayIso()
  const board = await buildChairBoard(ctx.db, ctx.profile.clinic_id, date)
  return json({ ok: true, date, chairs: board })
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const body = await request.json()
  const { action, chair_id: chairId } = body
  const cid = ctx.profile.clinic_id

  if (!chairId) return err('chair_id required')

  const chair = await ctx.db.collection('clinic_chairs').findOne({ id: chairId, clinic_id: cid })
  if (!chair) return err('Chair not found', 404)

  try {
    if (action === 'set_status') {
      const status = normalizeChairStatus(body.status)
      const update = { status }
      const now = new Date()
      if (status === 'available') {
        update.cleaning_finished_at = now
        update.current_appointment_id = null
      }
      if (status === 'cleaning') update.cleaning_started_at = now
      if (status === 'out_of_service') update.current_appointment_id = null

      await ctx.db.collection('clinic_chairs').updateOne({ id: chairId, clinic_id: cid }, { $set: update })
      return json({ ok: true })
    }

    if (action === 'release') {
      const appt = await ctx.db.collection('appointments').findOne({
        clinic_id: cid,
        chair_id: chairId,
        status: { $nin: ['completed', 'cancelled', 'no_show', 'archived'] },
      })
      if (appt) {
        await executeFlowAction(ctx.db, ctx.profile, appt.id, 'release_chair')
      } else {
        await ctx.db.collection('clinic_chairs').updateOne(
          { id: chairId, clinic_id: cid },
          { $set: { status: 'cleaning', cleaning_started_at: new Date(), current_appointment_id: null } }
        )
      }
      return json({ ok: true })
    }

    if (action === 'move_patient') {
      const { appointment_id: apptId, to_chair_id: toChairId } = body
      if (!apptId || !toChairId) return err('appointment_id and to_chair_id required')
      await executeFlowAction(ctx.db, ctx.profile, apptId, 'change_chair', { chair_id: toChairId })
      return json({ ok: true })
    }

    if (action === 'cleaning_complete') {
      await ctx.db.collection('clinic_chairs').updateOne(
        { id: chairId, clinic_id: cid },
        { $set: { status: 'available', cleaning_finished_at: new Date(), current_appointment_id: null } }
      )
      await logActivity(ctx.db, ctx.profile, ACTIVITY_EVENTS.CHAIR_RELEASED, {
        metadata: { chair_id: chairId, action: 'cleaning_complete' },
      })
      return json({ ok: true })
    }

    return err('Unknown action')
  } catch (e) {
    if (e instanceof FlowError) return err(e.message, e.status)
    console.error('Chair board action error:', e)
    return err('Internal server error', 500)
  }
}
