import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { executeLabFlowAction, LabFlowError } from '@/lib/lab-workflow-engine'
import { populateNames } from '@/lib/lab-case-helpers'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** POST /api/lab-cases/flow — execute lab workflow action */
export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const body = await request.json()
  const { case_id: caseId, action } = body
  if (!caseId || !action) return err('case_id and action required')

  try {
    const result = await executeLabFlowAction(ctx.db, ctx.profile, caseId, action, body)
    const enriched = await populateNames(ctx.db, ctx.profile.clinic_id, result)
    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(ctx.profile.clinic_id, 'lab_case')
    return json({ ok: true, lab_case: enriched })
  } catch (e) {
    if (e instanceof LabFlowError) return err(e.message, e.status)
    console.error('Lab flow action error:', e)
    return err('Internal server error', 500)
  }
}
