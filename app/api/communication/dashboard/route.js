import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  getCommunicationDashboard,
  getPatientCommunicationCenter,
} from '@/lib/communication-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    const patientId = url.searchParams.get('patient_id')

    if (patientId) {
      return json(await getPatientCommunicationCenter(ctx.db, ctx.profile.clinic_id, patientId))
    }

    return json(await getCommunicationDashboard(ctx.db, ctx.profile.clinic_id))
  } catch (e) {
    console.error('Communication dashboard error:', e)
    return err('Internal server error', 500)
  }
}
