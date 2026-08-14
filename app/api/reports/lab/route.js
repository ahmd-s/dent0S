import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getLabAnalytics, parseAnalyticsRange, toCsv } from '@/lib/analytics-engine'
import { normalizeLabStatus, CLOSED_STATUSES } from '@/lib/lab-case-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/reports/lab?days=30 — lab analytics */
export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const opts = parseAnalyticsRange({ days: url.searchParams.get('days') || 30 })
  const since = opts.start
  const cid = ctx.profile.clinic_id
  const format = url.searchParams.get('format')

  const [events, cases, metrics, vendors] = await Promise.all([
    ctx.db.collection('activity_events').find({
      clinic_id: cid,
      module: 'lab',
      created_at: { $gte: since },
    }).toArray(),
    ctx.db.collection('lab_cases').find({ clinic_id: cid }).toArray(),
    getLabAnalytics(ctx.db, cid),
    ctx.db.collection('vendors').find({ clinic_id: cid, is_archived: { $ne: true } }).toArray(),
  ])

  const counts = {}
  for (const e of events) counts[e.event] = (counts[e.event] || 0) + 1

  const byTreatment = {}
  const byDoctor = {}
  for (const c of cases) {
    byTreatment[c.case_type || 'Other'] = (byTreatment[c.case_type || 'Other'] || 0) + 1
    const doc = c.created_by || 'unknown'
    byDoctor[doc] = (byDoctor[doc] || 0) + 1
  }

  const vendorComparison = {}
  for (const v of vendors) {
    const vc = cases.filter(c => c.vendor_id === v.id)
    const delayed = vc.filter(c =>
      !CLOSED_STATUSES.includes(normalizeLabStatus(c.status)) &&
      c.expected_delivery_date &&
      new Date(c.expected_delivery_date + 'T00:00:00') < new Date()
    )
    const completed = vc.filter(c => normalizeLabStatus(c.status) === 'completed')
    vendorComparison[v.id] = {
      name: v.name,
      total: vc.length,
      completed: completed.length,
      delayed: delayed.length,
      delay_rate_pct: vc.length ? Math.round((delayed.length / vc.length) * 100) : 0,
    }
  }

  const topVendors = Object.values(vendorComparison).sort((a, b) => b.total - a.total).slice(0, 5)
  const lateDeliveries = cases.filter(c =>
    c.expected_delivery_date && c.actual_delivery_date &&
    c.actual_delivery_date > c.expected_delivery_date
  ).length

  const withDelivery = cases.filter(c => c.actual_delivery_date && c.expected_delivery_date)
  const onTime = withDelivery.filter(c => c.actual_delivery_date <= c.expected_delivery_date).length
  const deliveryAccuracy = withDelivery.length ? Math.round((onTime / withDelivery.length) * 100) : null

  if (format === 'csv') {
    const rows = topVendors.map(v => ({ name: v.name, total: v.total, delayed: v.delayed }))
    const csv = toCsv(rows.length ? rows : [{ name: 'none', total: 0, delayed: 0 }], ['name', 'total', 'delayed'])
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="lab-report.csv"' },
    })
  }

  return json({
    ok: true,
    days: opts.days,
    pdf_ready: true,
    export_ready: true,
    metrics: {
      ...metrics,
      completion_rate_pct: cases.length
        ? Math.round((cases.filter(c => normalizeLabStatus(c.status) === 'completed').length / cases.length) * 100)
        : 0,
      delivery_accuracy_pct: deliveryAccuracy,
      late_deliveries: lateDeliveries,
      cases_by_treatment: byTreatment,
      cases_by_doctor: byDoctor,
      top_vendors: topVendors,
      event_counts: counts,
    },
  })
}
