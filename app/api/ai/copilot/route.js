import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, enforceRateLimit } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { getCopilotSnapshot } from '@/lib/ai-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const rate = await enforceRateLimit(request, ctx.profile.id)
    if (!rate.allowed) return err('Rate limit exceeded. Try again later.', 429)

    const patientId = new URL(request.url).searchParams.get('patient_id')
    if (!patientId) return err('patient_id required', 400)

    return json(await getCopilotSnapshot(ctx.db, ctx.profile, { patientId }))
  } catch (e) {
    console.error('AI copilot error:', e)
    return err('Internal server error', 500)
  }
}
