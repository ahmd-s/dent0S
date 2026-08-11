import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  getPatientTimeline,
  parseTimelineQuery,
  validateTimelineFilters,
} from '@/lib/activity-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const patientId = params.id
    const patient = await ctx.db.collection('patients').findOne({
      id: patientId,
      clinic_id: ctx.profile.clinic_id,
    })
    if (!patient) return err('Not found', 404)

    const url = new URL(request.url)
    const opts = parseTimelineQuery(url.searchParams)
    const validation = validateTimelineFilters(opts)
    if (!validation.ok) return err(validation.error, 400)

    const result = await getPatientTimeline(ctx.db, ctx.profile.clinic_id, patientId, opts)
    if (!result.ok) return err(result.error, 400)

    return json(result)
  } catch (e) {
    console.error('Patient timeline GET error:', e)
    return err('Internal server error', 500)
  }
}
