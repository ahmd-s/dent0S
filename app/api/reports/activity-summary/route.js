import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/reports/activity-summary
 * Event counts by module from activity_events (last 30 days).
 */
export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 365)
    const since = new Date()
    since.setDate(since.getDate() - days)

    const rows = await ctx.db.collection('activity_events').aggregate([
      {
        $match: {
          clinic_id: ctx.profile.clinic_id,
          created_at: { $gte: since },
        },
      },
      {
        $group: {
          _id: { module: '$module', event: '$event' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray()

    const byModule = {}
    let total = 0
    for (const row of rows) {
      const mod = row._id.module || 'other'
      byModule[mod] = (byModule[mod] || 0) + row.count
      total += row.count
    }

    return json({
      ok: true,
      days,
      total,
      by_module: byModule,
      breakdown: rows.map(r => ({
        module: r._id.module,
        event: r._id.event,
        count: r.count,
      })),
    })
  } catch (e) {
    console.error('Activity summary error:', e)
    return err('Internal server error', 500)
  }
}
