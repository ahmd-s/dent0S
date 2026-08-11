import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { executeFlowAction, FlowError } from '@/lib/dental-flow-engine'
import { enrichAppointments } from '@/lib/appointment-enrichment'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * POST /api/appointments/flow
 * Execute a dental flow action on an appointment.
 * Body: { appointment_id, action, ...payload }
 */
export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const body = await request.json()
  const { appointment_id: appointmentId, action } = body
  if (!appointmentId || !action) return err('appointment_id and action required')

  try {
    const result = await executeFlowAction(ctx.db, ctx.profile, appointmentId, action, body)
    const [enriched] = await enrichAppointments(ctx.db, ctx.profile.clinic_id, [result])
    return json({ ok: true, appointment: enriched })
  } catch (e) {
    if (e instanceof FlowError) return err(e.message, e.status)
    console.error('Flow action error:', e)
    return err('Internal server error', 500)
  }
}
