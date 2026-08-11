import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getExecutiveDashboard, parseAnalyticsRange } from '@/lib/analytics-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/analytics/executive?days=30&from=&to= */
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

    const data = await getExecutiveDashboard(ctx.db, ctx.profile.clinic_id, opts)
    return json({ ok: true, days: opts.days, ...data })
  } catch (e) {
    console.error('Executive analytics error:', e)
    return err('Internal server error', 500)
  }
}
