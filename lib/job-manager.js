/**
 * Sprint 19 — Background job manager.
 * Supports reminders, AI queue, communication, analytics refresh, cache refresh, cleanup, retry, health checks.
 */

import { logJobStatus } from '@/lib/system-observability'
import { unwrapFindOneAndUpdate } from '@/lib/mongo-result'

export const COLLECTION = 'background_jobs'

export const JOB_TYPES = {
  REMINDER_PROCESS: 'reminder_process',
  COMMUNICATION_QUEUE: 'communication_queue',
  AI_QUEUE: 'ai_queue',
  ANALYTICS_REFRESH: 'analytics_refresh',
  CACHE_REFRESH: 'cache_refresh',
  LOG_CLEANUP: 'log_cleanup',
  RATE_LIMIT_CLEANUP: 'rate_limit_cleanup',
  HEALTH_CHECK: 'health_check',
  TRIAL_EXPIRY: 'trial_expiry',
}

export const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRY: 'retry',
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5 * 60 * 1000

/**
 * How long a job may stay RUNNING before another worker may reclaim it.
 *
 * Without this, a worker that dies mid-job leaves the row RUNNING forever, and
 * `scheduleRecurringJobs` then refuses to re-enqueue that type because it sees
 * an in-flight row — one crash permanently stalled the communication queue.
 */
const LEASE_MS = Number(process.env.JOB_LEASE_MS || 10 * 60 * 1000)

function jobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Enqueue a background job. */
export async function enqueueJob(db, { type, clinicId = null, payload = {}, priority = 0, scheduledAt = null } = {}) {
  const doc = {
    id: jobId(),
    type,
    clinic_id: clinicId,
    payload,
    priority,
    status: JOB_STATUS.PENDING,
    attempts: 0,
    max_retries: MAX_RETRIES,
    scheduled_at: scheduledAt ? new Date(scheduledAt) : new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    started_at: null,
    completed_at: null,
    error: null,
  }
  await db.collection(COLLECTION).insertOne(doc)
  return doc
}

/** Get pending jobs ready to run. */
export async function getPendingJobs(db, { limit = 10, type } = {}) {
  const filter = {
    status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RETRY] },
    scheduled_at: { $lte: new Date() },
  }
  if (type) filter.type = type
  return db.collection(COLLECTION)
    .find(filter)
    .sort({ priority: -1, scheduled_at: 1 })
    .limit(limit)
    .toArray()
}

/** Mark job as running. */
export async function markJobRunning(db, id) {
  return db.collection(COLLECTION).updateOne(
    { id },
    { $set: { status: JOB_STATUS.RUNNING, started_at: new Date(), updated_at: new Date() }, $inc: { attempts: 1 } }
  )
}

/**
 * Atomically take ownership of one runnable job.
 *
 * Reading a batch of pending jobs and then marking each one RUNNING let two
 * concurrent cron invocations pick up the same job and run it twice. The status
 * guard in the filter means only the worker whose update actually matched gets
 * the job; everyone else moves on.
 *
 * A RUNNING job whose lease has expired is also claimable, which is what
 * recovers work abandoned by a crashed worker.
 */
export async function claimNextJob(db, { type } = {}) {
  const now = new Date()
  const filter = {
    $or: [
      { status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RETRY] }, scheduled_at: { $lte: now } },
      { status: JOB_STATUS.RUNNING, started_at: { $lt: new Date(now.getTime() - LEASE_MS) } },
    ],
  }
  if (type) filter.type = type

  return db.collection(COLLECTION).findOneAndUpdate(
    filter,
    {
      $set: { status: JOB_STATUS.RUNNING, started_at: now, updated_at: now },
      $inc: { attempts: 1 },
    },
    { sort: { priority: -1, scheduled_at: 1 }, returnDocument: 'after' }
  )
}

/** Mark job completed. */
export async function markJobCompleted(db, id, result = {}) {
  await db.collection(COLLECTION).updateOne(
    { id },
    { $set: { status: JOB_STATUS.COMPLETED, completed_at: new Date(), updated_at: new Date(), result } }
  )
  await logJobStatus(db, id, 'completed', result)
}

/** Mark job failed with optional retry. */
export async function markJobFailed(db, id, error, { retry = true } = {}) {
  const job = await db.collection(COLLECTION).findOne({ id })
  const shouldRetry = retry && job && job.attempts < (job.max_retries || MAX_RETRIES)

  const update = {
    status: shouldRetry ? JOB_STATUS.RETRY : JOB_STATUS.FAILED,
    error: String(error?.message || error).slice(0, 500),
    updated_at: new Date(),
  }
  if (shouldRetry) {
    update.scheduled_at = new Date(Date.now() + RETRY_DELAY_MS)
  } else {
    update.completed_at = new Date()
  }

  await db.collection(COLLECTION).updateOne({ id }, { $set: update })
  await logJobStatus(db, id, shouldRetry ? 'retry' : 'failed', { error: update.error })
}

/**
 * Job processors — delegate to existing engines, no duplicate logic.
 *
 * `alreadyClaimed` is set when the caller took the job via claimNextJob, which
 * has already flipped it to RUNNING and incremented `attempts`.
 */
export async function processJob(db, job, { alreadyClaimed = false } = {}) {
  if (!alreadyClaimed) await markJobRunning(db, job.id)
  try {
    let result = {}

    switch (job.type) {
      case JOB_TYPES.REMINDER_PROCESS:
      case JOB_TYPES.COMMUNICATION_QUEUE: {
        const { processCommunicationScheduler } = await import('@/lib/communication')
        result = await processCommunicationScheduler(db, job.clinic_id || null)
        break
      }
      case JOB_TYPES.ANALYTICS_REFRESH: {
        const { invalidateAnalyticsCache } = await import('@/lib/analytics-engine')
        if (typeof invalidateAnalyticsCache === 'function') {
          invalidateAnalyticsCache(job.clinic_id)
        }
        result = { refreshed: true }
        break
      }
      case JOB_TYPES.LOG_CLEANUP: {
        const { pruneOldLogs } = await import('@/lib/system-observability')
        result = await pruneOldLogs(db)
        break
      }
      case JOB_TYPES.RATE_LIMIT_CLEANUP: {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const r1 = await db.collection('api_rate_limits').deleteMany({ updated_at: { $lt: cutoff } })
        const r2 = await db.collection('login_rate_limits').deleteMany({
          locked_until: { $lt: new Date() },
          failed_attempts: { $lt: 1 },
        })
        result = { apiDeleted: r1.deletedCount, loginDeleted: r2.deletedCount }
        break
      }
      case JOB_TYPES.HEALTH_CHECK: {
        await db.command({ ping: 1 })
        result = { healthy: true, at: new Date().toISOString() }
        break
      }
      case JOB_TYPES.TRIAL_EXPIRY: {
        // Delegates to existing cron handler logic via fetch in cron route
        result = { delegated: 'trial_expiry_cron' }
        break
      }
      default:
        result = { skipped: true, reason: 'unknown_type' }
    }

    await markJobCompleted(db, job.id, result)
    return { ok: true, result }
  } catch (error) {
    await markJobFailed(db, job.id, error)
    return { ok: false, error: error.message }
  }
}

/**
 * Process pending jobs (cron entry point).
 *
 * Jobs are claimed one at a time rather than read as a batch, so overlapping
 * cron invocations divide the queue instead of duplicating it. Execution stays
 * serial: several job types touch the same collections, and running them
 * concurrently would trade a duplicate-work bug for a contention one.
 */
export async function processPendingJobs(db, { limit = 20 } = {}) {
  const results = []
  for (let i = 0; i < limit; i++) {
    const claim = await claimNextJob(db)
    const job = unwrapFindOneAndUpdate(claim)
    if (!job?.id) break
    results.push({ id: job.id, type: job.type, ...(await processJob(db, job, { alreadyClaimed: true })) })
  }
  return { processed: results.length, results }
}

/** Queue status for dashboards. */
export async function getQueueStatus(db, { clinicId } = {}) {
  const match = clinicId ? { clinic_id: clinicId } : {}
  const [byStatus, byType, failedRecent] = await Promise.all([
    db.collection(COLLECTION).aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray(),
    db.collection(COLLECTION).aggregate([
      { $match: match },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).toArray(),
    db.collection(COLLECTION).find({ ...match, status: JOB_STATUS.FAILED })
      .sort({ updated_at: -1 })
      .limit(10)
      .toArray(),
  ])

  return {
    byStatus: Object.fromEntries(byStatus.map(r => [r._id, r.count])),
    byType: Object.fromEntries(byType.map(r => [r._id, r.count])),
    recentFailures: failedRecent.map(j => ({
      id: j.id,
      type: j.type,
      error: j.error,
      at: j.updated_at,
    })),
  }
}

/** Schedule recurring jobs (call from cron). */
export async function scheduleRecurringJobs(db) {
  const recurring = [
    { type: JOB_TYPES.COMMUNICATION_QUEUE, priority: 10 },
    { type: JOB_TYPES.LOG_CLEANUP, priority: 1 },
    { type: JOB_TYPES.RATE_LIMIT_CLEANUP, priority: 1 },
    { type: JOB_TYPES.HEALTH_CHECK, priority: 5 },
  ]

  const staleBefore = new Date(Date.now() - LEASE_MS)

  // One query for all four types instead of four sequential lookups. A RUNNING
  // row past its lease no longer counts as in-flight, so an abandoned job can't
  // block its type from being scheduled again.
  const inFlight = await db.collection(COLLECTION).find(
    {
      type: { $in: recurring.map(r => r.type) },
      $or: [
        { status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RETRY] } },
        { status: JOB_STATUS.RUNNING, started_at: { $gte: staleBefore } },
      ],
    },
    { projection: { type: 1 } }
  ).toArray()

  const busy = new Set(inFlight.map(j => j.type))
  const toCreate = recurring.filter(spec => !busy.has(spec.type))

  const jobs = await Promise.all(
    toCreate.map(spec => enqueueJob(db, { type: spec.type, priority: spec.priority }))
  )
  return { created: jobs.map(j => j.id) }
}
