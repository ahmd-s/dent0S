import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { computeFlowMetrics } from '@/lib/dental-flow-engine'
import { todayIso } from '@/lib/appointment-time'
import { getProfileRoles } from '@/lib/profile-roles'
import { doctorAppointmentFilter } from '@/lib/doctor-scope'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/appointments/flow/stats?date= — flow metrics for dashboards */
export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const date = url.searchParams.get('date') || todayIso()
  const roles = getProfileRoles(ctx.profile)
  const doctorFilter = doctorAppointmentFilter(roles, ctx.profile.id)

  const metrics = await computeFlowMetrics(ctx.db, ctx.profile.clinic_id, date, doctorFilter)
  return json({ ok: true, date, metrics })
}
