import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getCommunicationHistory } from '@/lib/communication-engine'

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
    const result = await getCommunicationHistory(ctx.db, ctx.profile.clinic_id, {
      patientId: url.searchParams.get('patient_id'),
      type: url.searchParams.get('type'),
      status: url.searchParams.get('status'),
      limit: parseInt(url.searchParams.get('limit') || '50', 10),
      skip: parseInt(url.searchParams.get('skip') || '0', 10),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    })

    return json(result)
  } catch (e) {
    console.error('Communication history error:', e)
    return err('Internal server error', 500)
  }
}
