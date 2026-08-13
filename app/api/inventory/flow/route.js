import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { executeInventoryFlowAction, InventoryFlowError } from '@/lib/inventory-workflow-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** POST /api/inventory/flow — inventory lifecycle actions */
export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const body = await request.json()
    const { item_id: itemId, action } = body
    if (!itemId || !action) return err('item_id and action required')

    const result = await executeInventoryFlowAction(ctx.db, ctx.profile, itemId, action, body)
    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(ctx.profile.clinic_id, 'inventory')
    return json({ ok: true, result })
  } catch (e) {
    if (e instanceof InventoryFlowError) return err(e.message, e.status)
    console.error('Inventory flow error:', e)
    return err('Internal server error', 500)
  }
}
