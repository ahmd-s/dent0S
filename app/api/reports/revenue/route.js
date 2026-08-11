import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getRevenueAnalytics, parseAnalyticsRange, toCsv } from '@/lib/analytics-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

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
  const doctorId = url.searchParams.get('doctor_id')

  let revenue = await getRevenueAnalytics(ctx.db, ctx.profile.clinic_id, opts)

  if (doctorId && revenue.revenue_by_doctor) {
    revenue = {
      ...revenue,
      filtered_doctor_id: doctorId,
      filtered_revenue: revenue.revenue_by_doctor[doctorId] || 0,
    }
  }

  if (format === 'csv') {
    const rows = Object.entries(revenue.monthly || {}).map(([month, rev]) => ({ month, revenue: rev }))
    const csv = toCsv(rows, ['month', 'revenue'])
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="revenue-report.csv"' },
    })
  }

  return json({ ok: true, days: opts.days, pdf_ready: true, export_ready: true, revenue })
}
