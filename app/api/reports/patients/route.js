import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getPatientAnalytics, parseAnalyticsRange, toCsv } from '@/lib/analytics-engine'

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

  const patients = await getPatientAnalytics(ctx.db, ctx.profile.clinic_id, opts)

  if (format === 'csv') {
    const rows = (patients.high_value_patients || []).map(p => ({
      name: p.name, patient_id: p.patient_id, spend: p.spend,
    }))
    const csv = toCsv(rows.length ? rows : [{ name: 'No data', patient_id: '', spend: 0 }], ['name', 'patient_id', 'spend'])
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="patients-report.csv"' },
    })
  }

  return json({ ok: true, days: opts.days, pdf_ready: true, export_ready: true, patients })
}
