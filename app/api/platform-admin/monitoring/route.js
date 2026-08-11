import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { runDiagnostics } from '@/lib/diagnostics-engine'
import { getObservabilityMetrics, getRecentLogs } from '@/lib/system-observability'
import { getQueueStatus, JOB_STATUS } from '@/lib/job-manager'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [diagnostics, metrics, queues, aiStats, commFailed, slowQueries, criticalLogs] = await Promise.all([
      runDiagnostics(db, { scope: 'platform' }),
      getObservabilityMetrics(db, { sinceHours: 24 }).catch(() => ({ errorCount: 0, slowApiCount: 0, avgApiLatencyMs: 0 })),
      getQueueStatus(db).catch(() => ({ byStatus: {}, recentFailures: [] })),
      db.collection('ai_requests').aggregate([
        { $match: { created_at: { $gte: since24h } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            clinics: { $addToSet: '$clinic_id' },
          },
        },
      ]).toArray().catch(() => []),
      db.collection('communication_messages').countDocuments({
        status: 'failed',
        created_at: { $gte: since24h },
      }).catch(() => 0),
      getRecentLogs(db, { limit: 10, category: 'db', sinceHours: 24 }).catch(() => []),
      getRecentLogs(db, { limit: 20, level: 'critical', sinceHours: 48 }).catch(() => []),
    ])

    const ai = aiStats[0] || { total: 0, failed: 0, clinics: [] }
    const failedJobs = queues.byStatus?.[JOB_STATUS.FAILED] || 0

    const alerts = []
    if (metrics.errorCount > 50) alerts.push({ level: 'critical', message: `${metrics.errorCount} system errors in the last 24 hours` })
    if (failedJobs > 0) alerts.push({ level: 'warning', message: `${failedJobs} failed background jobs require attention` })
    if (commFailed > 20) alerts.push({ level: 'warning', message: `${commFailed} communication delivery failures in 24h` })
    if (metrics.slowApiCount > 30) alerts.push({ level: 'warning', message: `${metrics.slowApiCount} slow API requests detected` })
    for (const log of criticalLogs.slice(0, 3)) {
      alerts.push({ level: 'critical', message: log.message })
    }

    let uptimeHealthy = true
    try {
      await db.command({ ping: 1 })
    } catch {
      uptimeHealthy = false
    }

    return json({
      healthScore: diagnostics.healthScore,
      checks: diagnostics.checks,
      metrics,
      queues: {
        byStatus: queues.byStatus,
        failed: failedJobs,
        recentFailures: queues.recentFailures || [],
      },
      ai: {
        totalRequests: ai.total,
        failedRequests: ai.failed,
        clinicsActive: ai.clinics?.length || 0,
      },
      communication: { failedMessages: commFailed },
      expensiveQueries: slowQueries.map(q => ({
        message: q.message,
        durationMs: q.duration_ms,
        at: q.created_at,
      })),
      alerts,
      uptime: { healthy: uptimeHealthy },
      at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Enterprise monitoring error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
