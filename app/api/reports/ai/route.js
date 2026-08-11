import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { getAIAnalytics, parseAnalyticsRange, toCsv } from '@/lib/analytics-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const url = new URL(request.url)
    const opts = parseAnalyticsRange({
      days: url.searchParams.get('days') || 30,
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    })
    const format = url.searchParams.get('format')

    const ai = await getAIAnalytics(ctx.db, ctx.profile.clinic_id, opts)

    if (format === 'csv') {
      const rows = Object.entries(ai.by_type || {}).map(([type, count]) => ({ type, count }))
      const csv = toCsv(rows, ['type', 'count'])
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="ai-report.csv"' },
      })
    }

    return json({ ok: true, days: opts.days, pdf_ready: true, export_ready: true, ai })
  } catch (e) {
    console.error('AI report error:', e)
    return err('Internal server error', 500)
  }
}
