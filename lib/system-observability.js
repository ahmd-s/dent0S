/**
 * Sprint 19 — Centralized system observability.
 * Single source for API logs, errors, warnings, performance metrics, slow queries, and job status.
 * Wraps performance-monitor patterns; persists to MongoDB in production.
 */

import { trackApiCall, trackDbQuery } from '@/lib/performance-monitor'

const COLLECTION = 'system_logs'
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 100)
const SLOW_API_MS = Number(process.env.SLOW_API_MS || 500)
const LOG_RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS || 30)

const LEVELS = ['debug', 'info', 'warn', 'error', 'critical']
const CATEGORIES = [
  'system', 'api', 'db', 'job', 'security', 'performance', 'communication', 'ai', 'background',
]

let _db = null

export function bindObservabilityDb(db) {
  _db = db
}

function shouldPersist() {
  return process.env.NODE_ENV === 'production' || process.env.OBSERVABILITY_PERSIST === 'true'
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {}
  const out = { ...meta }
  for (const key of ['password', 'password_hash', 'token', 'secret', 'authorization']) {
    if (key in out) out[key] = '[REDACTED]'
  }
  return out
}

/**
 * Core log entry — all observability flows through here.
 */
export async function logSystemEvent(db, {
  level = 'info',
  category = 'system',
  message,
  route = null,
  method = null,
  clinicId = null,
  userId = null,
  durationMs = null,
  statusCode = null,
  meta = {},
  correlationId = null,
} = {}) {
  if (!message) return null
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    level: LEVELS.includes(level) ? level : 'info',
    category: CATEGORIES.includes(category) ? category : 'system',
    message: String(message).slice(0, 2000),
    route,
    method,
    clinic_id: clinicId || null,
    user_id: userId || null,
    duration_ms: durationMs,
    status_code: statusCode,
    meta: sanitizeMeta(meta),
    correlation_id: correlationId,
    created_at: new Date(),
  }

  const database = db || _db
  if (database && shouldPersist()) {
    try {
      await database.collection(COLLECTION).insertOne(entry)
    } catch (e) {
      console.error('[observability] persist failed:', e.message)
    }
  }

  const prefix = `[${entry.category.toUpperCase()}]`
  if (entry.level === 'error' || entry.level === 'critical') {
    console.error(prefix, entry.message, entry.meta)
  } else if (entry.level === 'warn') {
    console.warn(prefix, entry.message)
  } else if (process.env.NODE_ENV !== 'production') {
    console.log(prefix, entry.message)
  }

  return entry
}

export async function logApiRequest(db, {
  route, method, durationMs, statusCode, clinicId, userId, payloadSize = 0, correlationId, error = null,
}) {
  trackApiCall(route, method, durationMs, statusCode, payloadSize)

  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : durationMs > SLOW_API_MS ? 'warn' : 'info'
  const category = 'api'

  return logSystemEvent(db, {
    level,
    category,
    message: error || `${method} ${route} ${statusCode} (${durationMs.toFixed(0)}ms)`,
    route,
    method,
    clinicId,
    userId,
    durationMs,
    statusCode,
    correlationId,
    meta: { payloadSize, slow: durationMs > SLOW_API_MS },
  })
}

export async function logDbOperation(db, {
  collection, operation, durationMs, documentCount = 0, clinicId = null, meta = {},
}) {
  trackDbQuery(collection, operation, durationMs, documentCount)

  if (durationMs > SLOW_QUERY_MS) {
    return logSystemEvent(db, {
      level: 'warn',
      category: 'db',
      message: `Slow query: ${collection}.${operation} (${durationMs.toFixed(0)}ms, ${documentCount} docs)`,
      clinicId,
      durationMs,
      meta: { collection, operation, documentCount, ...meta },
    })
  }
  return null
}

export async function logError(db, message, { category = 'system', route, clinicId, userId, meta, correlationId } = {}) {
  return logSystemEvent(db, {
    level: 'error',
    category,
    message,
    route,
    clinicId,
    userId,
    meta,
    correlationId,
  })
}

export async function logWarning(db, message, opts = {}) {
  return logSystemEvent(db, { level: 'warn', ...opts, message })
}

export async function logJobStatus(db, jobId, status, meta = {}) {
  return logSystemEvent(db, {
    level: status === 'failed' ? 'error' : 'info',
    category: 'job',
    message: `Job ${jobId}: ${status}`,
    meta: { jobId, status, ...meta },
  })
}

export async function logUnhandledException(db, error, { route, correlationId } = {}) {
  return logSystemEvent(db, {
    level: 'critical',
    category: 'system',
    message: error?.message || 'Unhandled exception',
    route,
    correlationId,
    meta: { stack: error?.stack?.slice(0, 1000) },
  })
}

/** Wrap an API route handler with timing + logging. */
export function withObservability(handler, { routeName } = {}) {
  return async function observedHandler(request, context) {
    const start = performance.now()
    const correlationId = request.headers.get('x-correlation-id') || `req_${Date.now()}`
    let statusCode = 500
    let response
    try {
      response = await handler(request, context)
      statusCode = response?.status || 200
      return response
    } catch (error) {
      await logUnhandledException(null, error, { route: routeName, correlationId })
      throw error
    } finally {
      const durationMs = performance.now() - start
      const route = routeName || request.nextUrl?.pathname || 'unknown'
      const method = request.method || 'GET'
      logApiRequest(null, { route, method, durationMs, statusCode, correlationId }).catch(() => {})
    }
  }
}

/** Query recent logs for dashboards. */
export async function getRecentLogs(db, { limit = 100, level, category, clinicId, sinceHours = 24 } = {}) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000)
  const filter = { created_at: { $gte: since } }
  if (level) filter.level = level
  if (category) filter.category = category
  if (clinicId) filter.clinic_id = clinicId

  return db.collection(COLLECTION)
    .find(filter)
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray()
}

/** Aggregate metrics for health dashboards. */
export async function getObservabilityMetrics(db, { sinceHours = 24, clinicId } = {}) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000)
  const match = { created_at: { $gte: since } }
  if (clinicId) match.clinic_id = clinicId

  const [byLevel, byCategory, slowApis, errors, avgLatency] = await Promise.all([
    db.collection(COLLECTION).aggregate([
      { $match: match },
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]).toArray(),
    db.collection(COLLECTION).aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]).toArray(),
    db.collection(COLLECTION).countDocuments({
      ...match,
      category: 'api',
      'meta.slow': true,
    }),
    db.collection(COLLECTION).countDocuments({
      ...match,
      level: { $in: ['error', 'critical'] },
    }),
    db.collection(COLLECTION).aggregate([
      { $match: { ...match, category: 'api', duration_ms: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$duration_ms' }, p95: { $avg: '$duration_ms' } } },
    ]).toArray(),
  ])

  return {
    since,
    byLevel: Object.fromEntries(byLevel.map(r => [r._id, r.count])),
    byCategory: Object.fromEntries(byCategory.map(r => [r._id, r.count])),
    slowApiCount: slowApis,
    errorCount: errors,
    avgApiLatencyMs: avgLatency[0]?.avg ? Math.round(avgLatency[0].avg) : 0,
  }
}

/** Cleanup old logs (called by job manager). */
export async function pruneOldLogs(db) {
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const result = await db.collection(COLLECTION).deleteMany({ created_at: { $lt: cutoff } })
  return { deleted: result.deletedCount, cutoff }
}

export { COLLECTION, SLOW_QUERY_MS, SLOW_API_MS, LEVELS, CATEGORIES }
