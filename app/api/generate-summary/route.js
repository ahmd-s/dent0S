import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { generateClinicalSummary } from '@/lib/ai-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const body = await request.json()
    if (!body.patient_id) return err('patient_id required')

    const result = await generateClinicalSummary(ctx.db, ctx.profile, {
      patientId: body.patient_id,
      force: body.force,
    })

    if (!result.ok) return err(result.error || 'Failed', result.error?.includes('not found') ? 404 : 502)
    return json({ ok: true, summary: result.summary, generated_at: result.generated_at })
  } catch (e) {
    console.error('Generate summary error:', e)
    return err('Internal server error', 500)
  }
}
