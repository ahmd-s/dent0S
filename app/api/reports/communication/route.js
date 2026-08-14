import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getCommunicationAnalytics, parseAnalyticsRange, toCsv } from '@/lib/analytics-engine'

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
    const opts = parseAnalyticsRange({
      days: url.searchParams.get('days') || 30,
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    })
    const format = url.searchParams.get('format')

    const communication = await getCommunicationAnalytics(ctx.db, ctx.profile.clinic_id, opts)

    if (format === 'csv') {
      const rows = Object.entries(communication.by_type || {}).map(([type, v]) => ({
        type,
        count: v.count,
        delivered: v.delivered,
      }))
      const csv = toCsv(rows, ['type', 'count', 'delivered'])
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="communication-report.csv"' },
      })
    }

    return json({ ok: true, days: opts.days, pdf_ready: true, export_ready: true, communication })
  } catch (e) {
    console.error('Communication report error:', e)
    return err('Internal server error', 500)
  }
}
