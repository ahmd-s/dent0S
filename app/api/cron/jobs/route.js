import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { processPendingJobs, scheduleRecurringJobs } from '@/lib/job-manager'
import { logSystemEvent } from '@/lib/system-observability'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function authorizeCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = request.headers.get('authorization')
  const header = request.headers.get('x-cron-secret')
  return auth === `Bearer ${secret}` || header === secret
}

export async function GET(request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = await getDb()

    await scheduleRecurringJobs(db)
    const result = await processPendingJobs(db, { limit: 25 })

    await db.collection('platform_settings').updateOne(
      { _type: 'global' },
      { $set: { last_job_run: new Date(), last_job_result: result } },
      { upsert: true }
    )

    await logSystemEvent(db, {
      level: 'info',
      category: 'job',
      message: `Cron jobs processed: ${result.processed}`,
      meta: result,
    })

    return NextResponse.json({
      ok: true,
      ...result,
      at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Cron jobs error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  return GET(request)
}
