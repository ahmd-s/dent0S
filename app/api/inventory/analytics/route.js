import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { computeInventoryMetrics } from '@/lib/inventory-workflow-engine'
import { CONSUMPTION_MOVEMENT_TYPES } from '@/lib/inventory-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id

    const metrics = await computeInventoryMetrics(db, cid)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const thisMonthMovements = await db.collection('stock_movements')
      .find({
        clinic_id: cid,
        movement_type: { $in: [...CONSUMPTION_MOVEMENT_TYPES] },
        created_at: { $gte: monthStart },
      })
      .toArray()

    const costConsumedThisMonth = thisMonthMovements.reduce(
      (sum, m) => sum + ((m.quantity || 0) * (m.purchase_cost || 0)), 0
    )

    const monthlyConsumption = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date()
      monthDate.setMonth(monthDate.getMonth() - i)
      const mStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const mEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59)

      const monthMovements = await db.collection('stock_movements').find({
        clinic_id: cid,
        movement_type: { $in: [...CONSUMPTION_MOVEMENT_TYPES] },
        created_at: { $gte: mStart, $lte: mEnd },
      }).toArray()

      const totalOut = monthMovements.reduce((sum, m) => sum + (m.quantity || 0), 0)
      const cost = monthMovements.reduce((sum, m) => sum + ((m.quantity || 0) * (m.purchase_cost || 0)), 0)
      monthlyConsumption.push({
        month: monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        total_out: totalOut,
        cost,
      })
    }

    return json({
      total_items: metrics.total_items,
      total_value: metrics.total_value,
      low_stock_count: metrics.low_stock_count,
      expiring_soon_count: metrics.expiring_soon_count,
      total_consumed_this_month: metrics.monthly_consumption,
      cost_consumed_this_month: costConsumedThisMonth,
      most_consumed: metrics.top_consumed,
      monthly_consumption: monthlyConsumption,
    })
  } catch (e) {
    console.error('Analytics GET error:', e)
    return json({
      total_items: 0,
      total_value: 0,
      low_stock_count: 0,
      expiring_soon_count: 0,
      total_consumed_this_month: 0,
      cost_consumed_this_month: 0,
      most_consumed: [],
      monthly_consumption: [],
    })
  }
}
