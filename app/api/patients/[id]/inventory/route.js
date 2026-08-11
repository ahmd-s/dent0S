import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getPatientInventoryUsage } from '@/lib/inventory-workflow-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/patients/[id]/inventory — read-only patient material usage */
export async function GET(request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const patient = await ctx.db.collection('patients').findOne({
      id: params.id,
      clinic_id: ctx.profile.clinic_id,
    })
    if (!patient) return err('Not found', 404)

    const usage = await getPatientInventoryUsage(ctx.db, ctx.profile.clinic_id, params.id)
    return json({ ok: true, patient_id: params.id, ...usage })
  } catch (e) {
    console.error('Patient inventory error:', e)
    return err('Internal server error', 500)
  }
}
