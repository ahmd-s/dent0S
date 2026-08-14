import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  getInventoryAnalytics,
  parseAnalyticsRange,
  toCsv,
} from '@/lib/analytics-engine'
import { computeInventoryAlerts, getEnrichedInventoryItems } from '@/lib/inventory-workflow-engine'
import { CONSUMPTION_MOVEMENT_TYPES } from '@/lib/inventory-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/reports/inventory?days=30 — inventory analytics report */
export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const opts = parseAnalyticsRange({ days: url.searchParams.get('days') || 30 })
  const since = opts.start
  const cid = ctx.profile.clinic_id
  const format = url.searchParams.get('format')

  const [events, movements, metrics, alerts, items, purchases, vendors] = await Promise.all([
    ctx.db.collection('activity_events').find({
      clinic_id: cid,
      module: 'inventory',
      created_at: { $gte: since },
    }).toArray(),
    ctx.db.collection('stock_movements').find({
      clinic_id: cid,
      created_at: { $gte: since },
    }).toArray(),
    getInventoryAnalytics(ctx.db, cid),
    computeInventoryAlerts(ctx.db, cid),
    getEnrichedInventoryItems(ctx.db, cid),
    ctx.db.collection('inventory_purchases').find({ clinic_id: cid, created_at: { $gte: since } }).toArray(),
    ctx.db.collection('vendors').find({ clinic_id: cid, is_archived: { $ne: true } }).toArray(),
  ])

  if (format === 'csv') {
    const rows = items.map(i => ({ name: i.item_name, stock: i.current_stock, value: i.current_value, status: i.status }))
    const csv = toCsv(rows, ['name', 'stock', 'value', 'status'])
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="inventory-report.csv"' },
    })
  }

  const eventCounts = {}
  for (const e of events) eventCounts[e.event] = (eventCounts[e.event] || 0) + 1

  const byCategory = {}
  for (const item of items) {
    const cat = item.category || 'Other'
    byCategory[cat] = (byCategory[cat] || 0) + (item.current_value || 0)
  }

  const byDoctor = {}
  const byTreatment = {}
  for (const m of movements.filter(m => CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type))) {
    const doc = m.created_by || 'unknown'
    byDoctor[doc] = (byDoctor[doc] || 0) + (m.quantity || 0)
    if (m.treatment_name) byTreatment[m.treatment_name] = (byTreatment[m.treatment_name] || 0) + (m.quantity || 0)
  }

  const vendorSpend = {}
  for (const p of purchases.filter(p => p.status === 'received')) {
    if (!p.vendor_id) continue
    vendorSpend[p.vendor_id] = (vendorSpend[p.vendor_id] || 0) + (p.total_cost || 0)
  }
  const vendorReport = vendors.map(v => ({
    id: v.id,
    name: v.name,
    spend: vendorSpend[v.id] || 0,
  })).sort((a, b) => b.spend - a.spend)

  const purchaseTrend = {}
  for (const p of purchases) {
    const month = new Date(p.created_at).toLocaleString('en-US', { month: 'short', year: 'numeric' })
    purchaseTrend[month] = (purchaseTrend[month] || 0) + (p.total_cost || 0)
  }

  return json({
    ok: true,
    days: opts.days,
    pdf_ready: true,
    metrics,
    alerts_summary: {
      low_stock: alerts.low_stock.length,
      critical: alerts.critical_stock.length,
      expired: alerts.expired.length,
      expiring_soon: alerts.expiring_soon.length,
    },
    event_counts: eventCounts,
    inventory_value: metrics.total_value,
    category_distribution: byCategory,
    doctor_consumption: byDoctor,
    treatment_consumption: byTreatment,
    vendor_spend: vendorReport,
    purchase_trends: Object.entries(purchaseTrend).map(([month, spend]) => ({ month, spend })),
    expiry_report: alerts.expired,
    export_ready: true,
  })
}
