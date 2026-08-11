import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  getKpis,
  getBusinessHealth,
  parseAnalyticsRange,
  toCsv,
} from '@/lib/analytics-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/reports/business?days=30&format=csv */
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

  const [kpis, health] = await Promise.all([
    getKpis(ctx.db, cid, opts),
    getBusinessHealth(ctx.db, cid, opts),
  ])

  if (format === 'csv') {
    const rows = [
      { metric: 'Total Revenue', value: kpis.revenue.total_revenue },
      { metric: 'Growth %', value: kpis.revenue.growth_pct },
      { metric: 'New Patients', value: kpis.patients.new_patients },
      { metric: 'Retention %', value: kpis.patients.retention_pct },
      { metric: 'Business Health', value: health.score },
      { metric: 'Collection Efficiency %', value: kpis.revenue.collection_efficiency_pct },
    ]
    const csv = toCsv(rows, ['metric', 'value'])
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="business-report.csv"',
      },
    })
  }

  return json({
    ok: true,
    days: opts.days,
    pdf_ready: true,
    export_ready: true,
    health,
    ...kpis,
  })
}
