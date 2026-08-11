import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getQueueStatus, JOB_STATUS } from '@/lib/job-manager'

export async function GET() {
  const timestamp = new Date().toISOString()
  const environment = process.env.NODE_ENV || 'development'

  try {
    const db = await getDb()
    const t0 = Date.now()
    await db.command({ ping: 1 })
    const dbLatencyMs = Date.now() - t0

    let queues = { pending: 0, failed: 0 }
    try {
      const status = await getQueueStatus(db)
      queues.pending = (status.byStatus?.[JOB_STATUS.PENDING] || 0) + (status.byStatus?.[JOB_STATUS.RETRY] || 0)
      queues.failed = status.byStatus?.[JOB_STATUS.FAILED] || 0
    } catch { /* optional */ }

    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        dbLatencyMs,
        environment,
        queues,
        version: 'sprint-19',
        timestamp,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        environment,
        timestamp,
      },
      { status: 503 }
    )
  }
}
