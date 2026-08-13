import { requireUser, json, err } from '@/lib/api-helpers'
import { buildDashboardStats } from '@/lib/dashboard-stats'

function allowDashboardDebug() {
  return process.env.NODE_ENV !== 'production' || process.env.DASHBOARD_PERF_DEBUG === '1'
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') === 'core' ? 'core' : 'full'
    const debug = allowDashboardDebug()
    // nocache/timings are development/diagnostics only — never honor in production
    // unless DASHBOARD_PERF_DEBUG=1 is explicitly set on the server.
    const skipCache = debug && url.searchParams.get('nocache') === '1'
    const timings = debug && url.searchParams.get('timings') === '1'

    const stats = await buildDashboardStats(ctx.db, ctx.profile, ctx.clinic, {
      mode,
      skipCache,
      timings,
    })
    return json(stats)
  } catch (e) {
    console.error('Dashboard stats error:', e)
    return err('Internal server error', 500)
  }
}
