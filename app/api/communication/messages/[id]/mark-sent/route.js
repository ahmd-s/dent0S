import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { guardCommunication } from '@/lib/communication/guards'
import { markMessageSent } from '@/lib/communication'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(_request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const denied = guardCommunication(ctx, 'markSent', err)
    if (denied) return denied

    const result = await markMessageSent(ctx.db, ctx.profile, params.id)
    if (!result.ok) return err(result.error || 'Failed to mark as sent', 400)
    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(ctx.profile.clinic_id, 'communication')
    return json(result)
  } catch (e) {
    console.error('Communication mark-sent error')
    return err('Internal server error', 500)
  }
}
