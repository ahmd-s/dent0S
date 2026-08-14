import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, enforceRateLimit } from '@/lib/api-helpers'
import { guardCommunication } from '@/lib/communication/guards'
import { createMessage, listMessages } from '@/lib/communication'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const denied = guardCommunication(ctx, 'viewQueue', err)
    if (denied) return denied

    const url = new URL(request.url)
    const filter = url.searchParams.get('filter') || 'action_required'
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const skip = parseInt(url.searchParams.get('skip') || '0', 10)

    const result = await listMessages(ctx.db, ctx.profile.clinic_id, {
      filter,
      status,
      limit,
      skip,
    })
    return json(result)
  } catch (e) {
    console.error('Communication messages GET error')
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const denied = guardCommunication(ctx, 'createMessage', err)
    if (denied) return denied

    const rate = await enforceRateLimit(request, ctx.profile.id)
    if (!rate.allowed) return err('Rate limit exceeded. Try again later.', 429)

    const body = await request.json()
    if (body.clinic_id || body.clinicId) {
      return err('clinic_id must not be supplied by client', 400)
    }

    const result = await createMessage(ctx.db, ctx.profile, body)
    if (!result.ok) return err(result.error || 'Failed to create message', 400)
    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(ctx.profile.clinic_id, 'communication')
    return json(result)
  } catch (e) {
    console.error('Communication messages POST error')
    return err('Internal server error', 500)
  }
}
