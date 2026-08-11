import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { getCopilotSnapshot } from '@/lib/ai-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const patientId = new URL(request.url).searchParams.get('patient_id')
    if (!patientId) return err('patient_id required', 400)

    return json(await getCopilotSnapshot(ctx.db, ctx.profile, { patientId }))
  } catch (e) {
    console.error('AI copilot error:', e)
    return err('Internal server error', 500)
  }
}
