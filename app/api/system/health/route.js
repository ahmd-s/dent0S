import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { runDiagnostics } from '@/lib/diagnostics-engine'
import { getObservabilityMetrics } from '@/lib/system-observability'
import { getQueueStatus, JOB_STATUS } from '@/lib/job-manager'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx
    const clinicId = profile.clinic_id

    const t0 = Date.now()
    await db.command({ ping: 1 })
    const latencyMs = Date.now() - t0

    const [diagnostics, metrics, queues] = await Promise.all([
      runDiagnostics(db, { clinicId, scope: 'clinic' }),
      getObservabilityMetrics(db, { sinceHours: 24, clinicId }).catch(() => ({
        errorCount: 0, slowApiCount: 0, avgApiLatencyMs: 0,
      })),
      getQueueStatus(db, { clinicId }).catch(() => ({ byStatus: {}, recentFailures: [] })),
    ])

    const pending = (queues.byStatus?.[JOB_STATUS.PENDING] || 0) + (queues.byStatus?.[JOB_STATUS.RETRY] || 0)
    const failed = queues.byStatus?.[JOB_STATUS.FAILED] || 0

    // Engine health heuristics
    const commFailed = await db.collection('communication_messages').countDocuments({
      clinic_id: clinicId,
      status: 'failed',
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).catch(() => 0)

    const aiFailed = await db.collection('ai_requests').countDocuments({
      clinic_id: clinicId,
      status: 'failed',
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).catch(() => 0)

    return json({
      healthScore: diagnostics.healthScore,
      checks: diagnostics.checks,
      database: { connected: true, latencyMs },
      metrics,
      queues: { pending, failed, recentFailures: queues.recentFailures?.slice(0, 5) || [] },
      engines: {
        communication: commFailed > 5 ? 'warning' : 'healthy',
        ai: aiFailed > 3 ? 'warning' : 'healthy',
        activity: 'healthy',
        analytics: 'healthy',
      },
      at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('System health error:', e)
    return err('Internal server error', 500)
  }
}
