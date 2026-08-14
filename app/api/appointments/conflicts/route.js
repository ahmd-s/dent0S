import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { findAppointmentConflicts } from '@/lib/appointment-conflicts'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/appointments/conflicts
 * Check scheduling conflicts before save or drag-drop.
 */
export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const doctorId = url.searchParams.get('doctor_id')
  const chairId = url.searchParams.get('chair_id')
  const date = url.searchParams.get('date')
  const time = url.searchParams.get('time')
  const duration = parseInt(url.searchParams.get('duration') || '30', 10)
  const excludeId = url.searchParams.get('exclude_id')

  if (!date || !time) return err('date and time required')

  const result = await findAppointmentConflicts(ctx.db, {
    clinicId: ctx.profile.clinic_id,
    doctorId,
    chairId,
    appointmentDate: date,
    appointmentTime: time,
    durationMinutes: duration,
    excludeId,
  })

  return json({ ok: true, ...result })
}
