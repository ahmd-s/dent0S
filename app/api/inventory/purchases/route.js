import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'
import { createPurchaseRequest } from '@/lib/inventory-workflow-engine'
import { canManageInventory } from '@/lib/rbac'

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
    const status = url.searchParams.get('status')
    const f = { clinic_id: ctx.profile.clinic_id }
    if (status) f.status = status

    const purchases = await ctx.db.collection('inventory_purchases')
      .find(f)
      .sort({ created_at: -1 })
      .limit(100)
      .toArray()

    return json({ ok: true, purchases: purchases.map(clean) })
  } catch (e) {
    console.error('Purchases GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (!canManageInventory(ctx.profile)) return err('Forbidden', 403)

    const body = await request.json()
    if (!body.items?.length) return err('At least one item required')

    const purchase = await createPurchaseRequest(ctx.db, ctx.profile, body)
    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(ctx.profile.clinic_id, 'inventory')
    return json({ ok: true, purchase: clean(purchase) })
  } catch (e) {
    console.error('Purchases POST error:', e)
    return err('Internal server error', 500)
  }
}
