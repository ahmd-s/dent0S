import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, enforceRateLimit } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import {
  generateClinicalSummary,
  generatePatientHistorySummary,
  generatePatientExplanation,
  generateTreatmentSuggestions,
  generateFollowupSuggestion,
} from '@/lib/ai-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const rate = await enforceRateLimit(request, ctx.profile.id)
    if (!rate.allowed) return err('Rate limit exceeded. Try again later.', 429)

    const body = await request.json()
    const { action, patient_id: patientId, ...data } = body
    if (!patientId && action !== 'history') return err('patient_id required', 400)

    switch (action) {
      case 'history':
        return json(await generatePatientHistorySummary(ctx.db, ctx.profile, { patientId }))
      case 'treatment':
        return json(await generateTreatmentSuggestions(ctx.db, ctx.profile, { patientId }))
      case 'followup':
        return json(await generateFollowupSuggestion(ctx.db, ctx.profile, { patientId }))
      case 'explain':
        return json(await generatePatientExplanation(ctx.db, ctx.profile, { patientId, ...data }))
      default:
        return json(await generateClinicalSummary(ctx.db, ctx.profile, { patientId, force: data.force }))
    }
  } catch (e) {
    console.error('AI summary error:', e)
    return err('Internal server error', 500)
  }
}
