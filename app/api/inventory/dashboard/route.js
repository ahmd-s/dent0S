import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  getEnrichedInventoryItems,
  computeInventoryMetrics,
  computeInventoryAlerts,
} from '@/lib/inventory-workflow-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/inventory/dashboard — full inventory intelligence dashboard */
export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const category = url.searchParams.get('category')
    const q = url.searchParams.get('q')

    const filter = {}
    if (category) filter.category = category
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ item_name: re }, { description: re }]
    }

    const cid = ctx.profile.clinic_id
    const [items, metrics, alerts] = await Promise.all([
      getEnrichedInventoryItems(ctx.db, cid, filter),
      computeInventoryMetrics(ctx.db, cid),
      computeInventoryAlerts(ctx.db, cid),
    ])

    let filtered = items
    if (status) filtered = items.filter(i => i.status === status)

    return json({
      ok: true,
      items: filtered,
      metrics,
      alerts,
    })
  } catch (e) {
    console.error('Inventory dashboard error:', e)
    return err('Internal server error', 500)
  }
}
