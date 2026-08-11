import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { computeInventoryMetrics, computeInventoryAlerts } from '@/lib/inventory-workflow-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/inventory/flow/stats — inventory metrics & alerts */
export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const cid = ctx.profile.clinic_id
    const [metrics, alerts] = await Promise.all([
      computeInventoryMetrics(ctx.db, cid),
      computeInventoryAlerts(ctx.db, cid),
    ])

    return json({ ok: true, metrics, alerts })
  } catch (e) {
    console.error('Inventory stats error:', e)
    return err('Internal server error', 500)
  }
}
