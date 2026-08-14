import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getKpis, parseAnalyticsRange } from '@/lib/analytics-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/analytics/kpis?days=30 */
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

    const kpis = await getKpis(ctx.db, ctx.profile.clinic_id, opts)
    return json({ ok: true, days: opts.days, kpis })
  } catch (e) {
    console.error('KPIs error:', e)
    return err('Internal server error', 500)
  }
}
