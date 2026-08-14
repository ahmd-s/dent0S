import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { generatePrescriptionDraft, getPrescriptionAssistant } from '@/lib/ai-engine'

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

    const url = new URL(request.url)
    return json(await getPrescriptionAssistant(ctx.db, ctx.profile, {
      query: url.searchParams.get('q'),
      patientId: url.searchParams.get('patient_id'),
    }))
  } catch (e) {
    console.error('AI prescription GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const body = await request.json()
    return json(await generatePrescriptionDraft(ctx.db, ctx.profile, body))
  } catch (e) {
    console.error('AI prescription POST error:', e)
    return err('Internal server error', 500)
  }
}
