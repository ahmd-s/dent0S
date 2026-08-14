import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  getAppointmentTimeline,
  parseTimelineQuery,
  validateTimelineFilters,
} from '@/lib/activity-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const appt = await ctx.db.collection('appointments').findOne({
      id: params.id,
      clinic_id: ctx.profile.clinic_id,
    })
    if (!appt) return err('Not found', 404)

    const url = new URL(request.url)
    const opts = parseTimelineQuery(url.searchParams)
    const validation = validateTimelineFilters(opts)
    if (!validation.ok) return err(validation.error, 400)

    const result = await getAppointmentTimeline(ctx.db, ctx.profile.clinic_id, params.id, opts)
    if (!result.ok) return err(result.error, 400)

    return json(result)
  } catch (e) {
    console.error('Appointment timeline GET error:', e)
    return err('Internal server error', 500)
  }
}
