import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'
import { executePurchaseAction, InventoryFlowError } from '@/lib/inventory-workflow-engine'
import { canManageInventory } from '@/lib/rbac'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const purchase = await ctx.db.collection('inventory_purchases').findOne({
      id: params.id,
      clinic_id: ctx.profile.clinic_id,
    })
    if (!purchase) return err('Not found', 404)
    return json({ ok: true, purchase: clean(purchase) })
  } catch (e) {
    return err('Internal server error', 500)
  }
}

export async function POST(request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (!canManageInventory(ctx.profile)) return err('Forbidden', 403)

    const body = await request.json()
    const { action } = body
    if (!action) return err('action required')

    const purchase = await executePurchaseAction(ctx.db, ctx.profile, params.id, action, body)
    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(ctx.profile.clinic_id, 'inventory')
    return json({ ok: true, purchase: clean(purchase) })
  } catch (e) {
    if (e instanceof InventoryFlowError) return err(e.message, e.status)
    console.error('Purchase action error:', e)
    return err('Internal server error', 500)
  }
}
