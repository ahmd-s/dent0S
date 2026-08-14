import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getDoctorAnalytics, parseAnalyticsRange, toCsv } from '@/lib/analytics-engine'

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
  const doctorId = url.searchParams.get('doctor_id')

  let { doctors, leaderboard } = await getDoctorAnalytics(ctx.db, ctx.profile.clinic_id, opts)
  if (doctorId) doctors = doctors.filter(d => d.doctor_id === doctorId)

  if (format === 'csv') {
    const csv = toCsv(doctors, ['name', 'appointments', 'revenue', 'patients_handled', 'efficiency_score', 'productivity_score'])
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="doctors-report.csv"' },
    })
  }

  return json({ ok: true, days: opts.days, pdf_ready: true, export_ready: true, doctors, leaderboard })
}
