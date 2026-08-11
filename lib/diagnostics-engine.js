/**
 * Sprint 19 — Production diagnostics engine.
 * Automatic checks: routes, indexes, orphans, config, storage, webhooks, queues.
 */

import { getQueueStatus, JOB_STATUS, COLLECTION as JOBS_COLLECTION } from '@/lib/job-manager'
import { getObservabilityMetrics, COLLECTION as LOGS_COLLECTION } from '@/lib/system-observability'

const REQUIRED_ENV = ['MONGO_URL', 'DB_NAME', 'JWT_SECRET']
const RECOMMENDED_ENV = [
  'PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY', 'CRON_SECRET', 'CORS_ORIGINS',
  'RESEND_API_KEY', 'RAZORPAY_KEY_ID', 'CLOUDINARY_CLOUD_NAME',
]

const CRITICAL_INDEXES = [
  { collection: 'patients', keys: { clinic_id: 1 } },
  { collection: 'appointments', keys: { clinic_id: 1, appointment_date: -1 } },
  { collection: 'visits', keys: { clinic_id: 1, patient_id: 1 } },
  { collection: 'activity_events', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'communication_messages', keys: { clinic_id: 1, status: 1, scheduled_at: 1 } },
  { collection: 'ai_requests', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'background_jobs', keys: { status: 1, scheduled_at: 1 } },
  { collection: 'system_logs', keys: { created_at: -1 } },
]

function check(name, status, value, label, suggestion = null) {
  return { name, status, value, label, suggestion }
}

/** Environment configuration checks. */
export function checkEnvironment() {
  const checks = []
  for (const key of REQUIRED_ENV) {
    checks.push(check(
      key,
      process.env[key] ? 'healthy' : 'failed',
      process.env[key] ? 'Set' : 'Missing',
      'Required environment variable',
      process.env[key] ? null : `Set ${key} in deployment environment`,
    ))
  }
  for (const key of RECOMMENDED_ENV) {
    checks.push(check(
      key,
      process.env[key] ? 'healthy' : 'warning',
      process.env[key] ? 'Set' : 'Not set',
      'Recommended environment variable',
    ))
  }
  if (process.env.NODE_ENV === 'production' && (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS === '*')) {
    checks.push(check('CORS Security', 'warning', 'Wildcard', 'CORS allows all origins in production', 'Set CORS_ORIGINS to your app domain'))
  }
  return checks
}

/** Database health and index verification. */
export async function checkDatabase(db) {
  const checks = []
  try {
    const t0 = Date.now()
    await db.command({ ping: 1 })
    const latency = Date.now() - t0
    checks.push(check('MongoDB Connection', latency < 200 ? 'healthy' : 'warning', `${latency}ms`, 'Database ping'))
  } catch (e) {
    checks.push(check('MongoDB Connection', 'failed', null, e.message))
    return checks
  }

  for (const spec of CRITICAL_INDEXES) {
    try {
      const indexes = await db.collection(spec.collection).indexes()
      const hasIndex = indexes.some(idx => {
        const keys = Object.keys(spec.keys)
        return keys.every(k => idx.key[k] !== undefined)
      })
      checks.push(check(
        `Index: ${spec.collection}`,
        hasIndex ? 'healthy' : 'warning',
        hasIndex ? 'Present' : 'Missing',
        JSON.stringify(spec.keys),
        hasIndex ? null : 'Run scripts/run-indexes.js',
      ))
    } catch {
      checks.push(check(`Index: ${spec.collection}`, 'warning', 'Unknown', 'Collection may not exist yet'))
    }
  }

  return checks
}

/** Orphan record detection (sample checks). */
export async function checkOrphanRecords(db, { clinicId } = {}) {
  const checks = []
  try {
    const orphanVisits = await db.collection('visits').aggregate([
      ...(clinicId ? [{ $match: { clinic_id: clinicId } }] : []),
      { $lookup: { from: 'patients', localField: 'patient_id', foreignField: 'id', as: 'patient' } },
      { $match: { patient: { $size: 0 } } },
      { $count: 'count' },
    ]).toArray()
    const count = orphanVisits[0]?.count || 0
    checks.push(check(
      'Orphan Visits',
      count === 0 ? 'healthy' : 'warning',
      count,
      'Visits without matching patient',
      count > 0 ? 'Review and archive orphan visit records' : null,
    ))
  } catch {
    checks.push(check('Orphan Visits', 'warning', null, 'Check skipped'))
  }

  try {
    const orphanAppts = await db.collection('appointments').aggregate([
      ...(clinicId ? [{ $match: { clinic_id: clinicId } }] : []),
      { $lookup: { from: 'patients', localField: 'patient_id', foreignField: 'id', as: 'patient' } },
      { $match: { patient: { $size: 0 } } },
      { $count: 'count' },
    ]).toArray()
    const count = orphanAppts[0]?.count || 0
    checks.push(check(
      'Orphan Appointments',
      count === 0 ? 'healthy' : 'warning',
      count,
      'Appointments without matching patient',
    ))
  } catch {
    checks.push(check('Orphan Appointments', 'warning', null, 'Check skipped'))
  }

  return checks
}

/** Webhook and integration checks. */
export async function checkWebhooks(db) {
  const checks = []
  const rzOk = !!process.env.RAZORPAY_WEBHOOK_SECRET
  checks.push(check('Razorpay Webhook Secret', rzOk ? 'healthy' : 'warning', rzOk ? 'Configured' : 'Not set', 'Payment webhook verification'))

  try {
    const last = await db.collection('subscriptions').find({}).sort({ updated_at: -1 }).limit(1).toArray()
    const updated = last[0]?.updated_at
    if (!updated) {
      checks.push(check('Webhook Activity', 'warning', 'None', 'No subscription updates recorded'))
    } else {
      const hours = Math.floor((Date.now() - new Date(updated).getTime()) / (3600 * 1000))
      checks.push(check('Webhook Activity', hours < 168 ? 'healthy' : 'warning', `${hours}h ago`, 'Last subscription update'))
    }
  } catch {
    checks.push(check('Webhook Activity', 'failed', null, 'Read error'))
  }

  return checks
}

/** Queue and job health. */
export async function checkQueues(db, { clinicId } = {}) {
  const checks = []
  try {
    const status = await getQueueStatus(db, { clinicId })
    const pending = (status.byStatus[JOB_STATUS.PENDING] || 0) + (status.byStatus[JOB_STATUS.RETRY] || 0)
    const failed = status.byStatus[JOB_STATUS.FAILED] || 0
    checks.push(check('Job Queue Pending', pending < 100 ? 'healthy' : 'warning', pending, 'Pending/retry jobs'))
    checks.push(check('Job Queue Failed', failed === 0 ? 'healthy' : failed < 10 ? 'warning' : 'failed', failed, 'Failed background jobs'))
  } catch {
    checks.push(check('Job Queue', 'warning', null, 'Queue check failed'))
  }
  return checks
}

/** Storage usage estimate. */
export async function checkStorage(db) {
  const checks = []
  try {
    const stats = await db.command({ dbStats: 1 })
    const sizeMb = Math.round((stats.dataSize || 0) / 1024 / 1024)
    const storageMb = Math.round((stats.storageSize || 0) / 1024 / 1024)
    checks.push(check('Database Size', sizeMb < 5000 ? 'healthy' : 'warning', `${sizeMb} MB data / ${storageMb} MB storage`, 'MongoDB storage usage'))
  } catch {
    checks.push(check('Database Size', 'warning', null, 'Could not read db stats'))
  }
  return checks
}

/** Compute overall health score 0-100. */
export function computeHealthScore(checks) {
  if (!checks?.length) return 0
  let score = 0
  for (const c of checks) {
    if (c.status === 'healthy') score += 100
    else if (c.status === 'warning') score += 60
    else score += 0
  }
  return Math.round(score / checks.length)
}

/** Run full diagnostics suite. */
export async function runDiagnostics(db, { clinicId, scope = 'clinic' } = {}) {
  const envChecks = scope === 'platform' ? checkEnvironment() : []
  const dbChecks = await checkDatabase(db)
  const orphanChecks = await checkOrphanRecords(db, { clinicId })
  const webhookChecks = scope === 'platform' ? await checkWebhooks(db) : []
  const queueChecks = await checkQueues(db, { clinicId })
  const storageChecks = scope === 'platform' ? await checkStorage(db) : []

  let observabilityChecks = []
  if (scope === 'platform') {
    try {
      const metrics = await getObservabilityMetrics(db, { sinceHours: 24 })
      observabilityChecks.push(check(
        'API Errors (24h)',
        metrics.errorCount === 0 ? 'healthy' : metrics.errorCount < 50 ? 'warning' : 'failed',
        metrics.errorCount,
        'System log error count',
      ))
      observabilityChecks.push(check(
        'Slow APIs (24h)',
        metrics.slowApiCount < 20 ? 'healthy' : 'warning',
        metrics.slowApiCount,
        'Requests exceeding latency threshold',
      ))
    } catch {
      observabilityChecks.push(check('Observability', 'warning', null, 'Metrics unavailable'))
    }
  }

  const allChecks = [
    ...envChecks,
    ...dbChecks,
    ...orphanChecks,
    ...webhookChecks,
    ...queueChecks,
    ...storageChecks,
    ...observabilityChecks,
  ]

  return {
    checks: allChecks,
    healthScore: computeHealthScore(allChecks),
    at: new Date().toISOString(),
    scope,
  }
}

/** Backup readiness assessment. */
export async function getBackupStatus(db) {
  const checks = []
  try {
    await db.command({ ping: 1 })
    checks.push(check('Database Accessible', 'healthy', 'Yes', 'Ready for backup'))
  } catch {
    checks.push(check('Database Accessible', 'failed', 'No', 'Cannot connect'))
  }

  const atlasBackup = process.env.ATLAS_BACKUP_ENABLED === 'true'
  checks.push(check(
    'Cloud Backup Hook',
    atlasBackup ? 'healthy' : 'warning',
    atlasBackup ? 'Atlas enabled' : 'Manual only',
    'Atlas continuous backup (configure ATLAS_BACKUP_ENABLED=true when enabled)',
  ))

  let lastBackup = null
  try {
    const settings = await db.collection('platform_settings').findOne({ _type: 'global' })
    lastBackup = settings?.last_backup_at || null
  } catch { /* ignore */ }

  checks.push(check(
    'Last Backup Record',
    lastBackup ? 'healthy' : 'warning',
    lastBackup ? new Date(lastBackup).toISOString() : 'Not recorded',
    'Last recorded backup timestamp',
    lastBackup ? null : 'Record backup in platform settings after Atlas snapshot',
  ))

  const storageChecks = await checkStorage(db)

  return {
    checks: [...checks, ...storageChecks],
    lastBackup,
    restoreReady: checks.every(c => c.status !== 'failed'),
    at: new Date().toISOString(),
  }
}

export { REQUIRED_ENV, RECOMMENDED_ENV, CRITICAL_INDEXES }
