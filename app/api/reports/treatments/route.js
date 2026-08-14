import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getTreatmentAnalytics, parseAnalyticsRange, toCsv } from '@/lib/analytics-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

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
  const treatment = url.searchParams.get('treatment')

  let treatments = await getTreatmentAnalytics(ctx.db, ctx.profile.clinic_id, opts)
  if (treatment) {
    treatments = {
      ...treatments,
      filtered: treatments.top_treatments?.filter(t => t.name.toLowerCase().includes(treatment.toLowerCase())),
    }
  }

  if (format === 'csv') {
    const csv = toCsv(treatments.top_treatments || [], ['name', 'count'])
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="treatments-report.csv"' },
    })
  }

  return json({ ok: true, days: opts.days, pdf_ready: true, export_ready: true, treatments })
}
