import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  getRevenueAnalytics,
  getBusinessHealth,
  parseAnalyticsRange,
  toCsv,
} from '@/lib/analytics-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/reports/financial — alias for revenue + health financial summary */
export async function GET(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(request.url)
  const opts = parseAnalyticsRange({
    days: url.searchParams.get('days') || 30,
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  })
  const format = url.searchParams.get('format')
  const cid = ctx.profile.clinic_id

  const [revenue, health] = await Promise.all([
    getRevenueAnalytics(ctx.db, cid, opts),
    getBusinessHealth(ctx.db, cid, opts),
  ])

  const financial = {
    revenue,
    collection_efficiency_pct: revenue.collection_efficiency_pct,
    pending_collections: revenue.pending_collections,
    growth_pct: revenue.growth_pct,
    health_score: health.score,
  }

  if (format === 'csv') {
    const rows = Object.entries(revenue.revenue_by_payment_method || {}).map(([method, amount]) => ({
      payment_method: method, amount,
    }))
    const csv = toCsv(rows.length ? rows : [{ payment_method: 'none', amount: 0 }], ['payment_method', 'amount'])
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="financial-report.csv"' },
    })
  }

  return json({ ok: true, days: opts.days, pdf_ready: true, export_ready: true, financial })
}
