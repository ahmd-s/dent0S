import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { guardCommunication } from '@/lib/communication/guards'
import { recordMessageOpened } from '@/lib/communication'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(_request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const denied = guardCommunication(ctx, 'openWhatsApp', err)
    if (denied) return denied

    const result = await recordMessageOpened(ctx.db, ctx.profile, params.id)
    if (!result.ok) return err(result.error || 'Failed to record open', 400)
    return json(result)
  } catch (e) {
    console.error('Communication opened POST error')
    return err('Internal server error', 500)
  }
}
