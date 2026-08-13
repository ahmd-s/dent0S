/**
 * Measure dashboard stats against a real MongoDB.
 *
 *   MONGO_URL=... DB_NAME=... node scripts/measure-dashboard-stats.js
 *
 * Optional seed into a scratch DB (drops that DB — never production):
 *   MEASURE_SEED=1 MONGO_URL=... DB_NAME=dentos_measure node scripts/measure-dashboard-stats.js
 *
 * Prints cold full, warm cache, and core-mode timings plus executionStats.
 */
import { register } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

register(new URL('./measure-alias-hooks.mjs', import.meta.url))

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  for (const raw of readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value
  }
}

loadEnvFile(path.join(root, '.env.local'))
loadEnvFile(path.join(root, '.env'))

process.env.JWT_SECRET = process.env.JWT_SECRET || 'measure-dashboard-secret'
process.env.COMMUNICATION_DEFAULT_TIMEZONE =
  process.env.COMMUNICATION_DEFAULT_TIMEZONE || 'Asia/Kolkata'

function todayIsoTZ(tz = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function collectIndexNames(node, indexes = []) {
  if (!node || typeof node !== 'object') return indexes
  if (node.indexName) indexes.push(node.indexName)
  if (node.queryPlanner) collectIndexNames(node.queryPlanner, indexes)
  if (node.winningPlan) collectIndexNames(node.winningPlan, indexes)
  if (node.inputStage) collectIndexNames(node.inputStage, indexes)
  if (Array.isArray(node.inputStages)) node.inputStages.forEach(n => collectIndexNames(n, indexes))
  if (Array.isArray(node.stages)) node.stages.forEach(n => collectIndexNames(n, indexes))
  if (node.executionStats) collectIndexNames(node.executionStats, indexes)
  if (node.executionStages) collectIndexNames(node.executionStages, indexes)
  if (node.$cursor) collectIndexNames(node.$cursor, indexes)
  return indexes
}

function pickExecutionStats(explain) {
  if (explain?.executionStats) return explain.executionStats
  const stage0 = explain?.stages?.[0]
  if (stage0?.executionStats) return stage0.executionStats
  if (stage0?.$cursor?.executionStats) return stage0.$cursor.executionStats
  return explain
}

function summarizeExplain(label, explain) {
  const stats = pickExecutionStats(explain)
  const planner =
    explain.queryPlanner ||
    explain.stages?.[0]?.$cursor?.queryPlanner ||
    explain.stages?.[0]?.queryPlanner
  const winning = planner?.winningPlan || stats.executionStages
  const indexes = [...new Set(collectIndexNames(explain))]
  return {
    label,
    executionTimeMillis: stats.executionTimeMillis ?? stats.executionTimeMillisEstimate ?? null,
    totalDocsExamined: stats.totalDocsExamined ?? null,
    totalKeysExamined: stats.totalKeysExamined ?? null,
    nReturned: stats.nReturned ?? null,
    winningIndex: indexes[0] || null,
    indexesUsed: indexes,
    stage: winning?.stage || stats.executionStages?.stage || null,
    intendedIndexLikelyUsed:
      indexes.length > 0 ||
      ['IXSCAN', 'COUNT_SCAN', 'EXPRESS_IXSCAN'].includes(winning?.stage),
  }
}

async function seed(db) {
  const clinicId = 'clinic-measure-1'
  const today = todayIsoTZ()
  const yest = (() => {
    const d = new Date(`${today}T12:00:00`)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()

  await db.dropDatabase()
  await db.collection('clinics').insertOne({
    id: clinicId,
    name: 'Measure Dental',
    timezone: 'Asia/Kolkata',
    is_active: true,
  })
  const admin = {
    id: 'u-admin',
    clinic_id: clinicId,
    full_name: 'Admin User',
    roles: ['admin'],
    role: 'admin',
  }
  const doctor = {
    id: 'u-doctor',
    clinic_id: clinicId,
    full_name: 'Dr Measure',
    roles: ['doctor'],
    role: 'doctor',
  }
  await db.collection('profiles').insertMany([admin, doctor])

  await db.collection('patients').insertMany(
    Array.from({ length: 400 }, (_, i) => ({
      id: `p-${i}`,
      clinic_id: clinicId,
      name: `Patient ${i}`,
      phone: String(9000000000 + i),
      is_archived: false,
      next_followup_date: i % 20 === 0 ? today : i % 17 === 0 ? yest : null,
      total_visits: (i % 8) + 1,
      last_visit_date: yest,
      created_at: new Date(Date.now() - i * 86400000),
    }))
  )

  const appts = Array.from({ length: 60 }, (_, i) => ({
    id: `a-${i}`,
    clinic_id: clinicId,
    patient_id: `p-${i}`,
    doctor_id: i % 2 === 0 ? doctor.id : admin.id,
    appointment_date: today,
    appointment_time: `${String(9 + (i % 8)).padStart(2, '0')}:00 AM`,
    appointment_type: i % 11 === 0 ? 'emergency' : 'consultation',
    status: ['scheduled', 'checked_in', 'waiting', 'in_treatment', 'completed'][i % 5],
    priority: i % 11 === 0 ? 'emergency' : 'normal',
    checked_in_at: new Date(Date.now() - (i % 40) * 60000),
  }))
  for (let i = 0; i < 25; i++) {
    appts.push({
      id: `a-y-${i}`,
      clinic_id: clinicId,
      patient_id: `p-${i}`,
      doctor_id: doctor.id,
      appointment_date: yest,
      appointment_time: '10:00 AM',
      appointment_type: 'consultation',
      status: 'completed',
    })
  }
  await db.collection('appointments').insertMany(appts)

  await db.collection('invoices').insertMany(
    Array.from({ length: 120 }, (_, i) => ({
      id: `inv-${i}`,
      clinic_id: clinicId,
      patient_id: `p-${i % 100}`,
      invoice_date: i < 40 ? today : yest,
      payment_status: i % 3 === 0 ? 'pending' : i % 5 === 0 ? 'partial' : 'paid',
      total_amount: 500 + i * 25,
      amount_paid: i % 3 === 0 ? 0 : 500 + i * 10,
    }))
  )

  await db.collection('visits').insertMany(
    appts.slice(0, 30).map((a, i) => ({
      id: `v-${i}`,
      clinic_id: clinicId,
      appointment_id: a.id,
      patient_id: a.patient_id,
      doctor_id: a.doctor_id,
      visit_date: today,
      created_at: new Date(),
    }))
  )

  await db.collection('clinic_chairs').insertMany([
    { id: 'ch-1', clinic_id: clinicId, status: 'occupied', is_active: true },
    { id: 'ch-2', clinic_id: clinicId, status: 'available', is_active: true },
  ])

  const labStatuses = ['sent', 'lab_received', 'in_production', 'ready', 'delivered', 'completed']
  await db.collection('lab_cases').insertMany(
    Array.from({ length: 80 }, (_, i) => ({
      id: `lc-${i}`,
      clinic_id: clinicId,
      status: labStatuses[i % labStatuses.length],
      expected_delivery_date: i % 7 === 0 ? yest : today,
      vendor_id: `vendor-${i % 5}`,
      is_delayed: i % 9 === 0,
    }))
  )

  await db.collection('inventory_items').insertMany(
    Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      clinic_id: clinicId,
      item_name: `Item ${i}`,
      current_stock: i % 15,
      minimum_stock: 10,
      purchase_price: 100 + i,
      is_active: true,
    }))
  )

  const now = new Date()
  await db.collection('stock_movements').insertMany(
    Array.from({ length: 200 }, (_, i) => ({
      clinic_id: clinicId,
      item_id: `item-${i % 50}`,
      item_name: `Item ${i % 50}`,
      movement_type: i % 2 === 0 ? 'STOCK_OUT' : 'STOCK_IN',
      quantity: 1 + (i % 5),
      created_at: new Date(now.getTime() - (i % 20) * 3600000),
    }))
  )
  await db.collection('inventory_purchases').insertMany([
    { id: 'pur-1', clinic_id: clinicId, status: 'requested', total_cost: 1000 },
    { id: 'pur-2', clinic_id: clinicId, status: 'ordered', total_cost: 2000 },
    { id: 'pur-3', clinic_id: clinicId, status: 'received', total_cost: 1500, received_at: now },
  ])
  await db.collection('communication_messages').insertMany(
    Array.from({ length: 50 }, (_, i) => ({
      id: `cm-${i}`,
      clinic_id: clinicId,
      status: ['pending', 'scheduled', 'sent', 'failed'][i % 4],
      type: 'appointment_reminder',
      created_at: new Date(now.getTime() - i * 60000),
      scheduled_at: new Date(now.getTime() + i * 60000),
    }))
  )
  await db.collection('ai_requests').insertMany(
    Array.from({ length: 20 }, (_, i) => ({
      clinic_id: clinicId,
      type: 'clinical_summary',
      created_at: now,
    }))
  )
  await db.collection('activity_events').insertMany(
    Array.from({ length: 100 }, (_, i) => ({
      clinic_id: clinicId,
      created_at: new Date(now.getTime() - i * 86400000),
      event: 'visit.completed',
    }))
  )

  return { clinicId, admin, doctor, today }
}

/** explain via db.command so URI writeConcern (w=majority) is not attached. */
async function explainFind(db, collection, filter, extras = {}) {
  return db.command({
    explain: { find: collection, filter, ...extras },
    verbosity: 'executionStats',
  })
}

async function explainAggregate(db, collection, pipeline) {
  return db.command({
    explain: { aggregate: collection, pipeline, cursor: {} },
    verbosity: 'executionStats',
  })
}

async function runExplains(db, clinicId, today, doctorId) {
  const apptFilter = { clinic_id: clinicId, appointment_date: today }
  return [
    summarizeExplain(
      'appointments.find(today).sort(time)',
      await explainFind(db, 'appointments', apptFilter, { sort: { appointment_time: 1 }, limit: 200 })
    ),
    summarizeExplain(
      'appointments.count(completed today)',
      await explainFind(db, 'appointments', { ...apptFilter, status: 'completed' })
    ),
    summarizeExplain(
      'appointments.count(completed today doctor-scoped)',
      await explainFind(db, 'appointments', { ...apptFilter, status: 'completed', doctor_id: doctorId })
    ),
    summarizeExplain(
      'invoices.agg(paid today)',
      await explainAggregate(db, 'invoices', [
        { $match: { clinic_id: clinicId, payment_status: 'paid', invoice_date: today } },
        { $group: { _id: null, sum: { $sum: '$total_amount' } } },
      ])
    ),
    summarizeExplain(
      'invoices.agg(pending today)',
      await explainAggregate(db, 'invoices', [
        {
          $match: {
            clinic_id: clinicId,
            payment_status: { $in: ['pending', 'partial'] },
            invoice_date: today,
          },
        },
        { $group: { _id: null, sum: { $sum: '$total_amount' } } },
      ])
    ),
    summarizeExplain(
      'patients.find(followups due)',
      await explainFind(
        db,
        'patients',
        {
          clinic_id: clinicId,
          is_archived: { $ne: true },
          next_followup_date: { $ne: null, $lte: today },
        },
        { sort: { next_followup_date: 1 }, limit: 5 }
      )
    ),
    summarizeExplain(
      'lab_cases.agg(status counts)',
      await explainAggregate(db, 'lab_cases', [
        { $match: { clinic_id: clinicId } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ])
    ),
    summarizeExplain(
      'inventory_items.find(active)',
      await explainFind(db, 'inventory_items', { clinic_id: clinicId, is_active: { $ne: false } })
    ),
    summarizeExplain(
      'visits.find(by appointment_id $in)',
      await explainFind(db, 'visits', {
        clinic_id: clinicId,
        appointment_id: { $in: Array.from({ length: 30 }, (_, i) => `a-${i}`) },
      })
    ),
  ]
}

async function main() {
  const mongoUrl = process.env.MONGO_URL
  if (!mongoUrl) {
    console.error(`MONGO_URL is required.

Example:
  MONGO_URL='mongodb+srv://...' DB_NAME=dentos_measure MEASURE_SEED=1 \\
    node scripts/measure-dashboard-stats.js`)
    process.exit(2)
  }

  const dbName = process.env.DB_NAME || 'dentos_db'
  const client = new MongoClient(mongoUrl)
  await client.connect()
  const db = client.db(dbName)

  try {
    await measureAgainstDb(db, dbName)
  } finally {
    await client.close()
  }
}

async function measureAgainstDb(db, dbName) {
  const { setupIndexes } = await import('../lib/setup-indexes.js')
  const { buildDashboardStats, invalidateDashboardRelatedCaches } = await import('../lib/dashboard-stats.js')
  const { _resetDashboardCacheForTests } = await import('../lib/dashboard-cache.js')

  let clinicId
  let admin
  let doctor
  let today
  let clinic

  if (process.env.MEASURE_SEED === '1') {
    console.log(`Seeding measure dataset into ${dbName}…`)
    ;({ clinicId, admin, doctor, today } = await seed(db))
    await setupIndexes(db)
    clinic = await db.collection('clinics').findOne({ id: clinicId })
  } else {
    clinic = await db.collection('clinics').findOne({})
    if (!clinic) {
      throw new Error('No clinic found — set MEASURE_SEED=1 or point at a populated DB')
    }
    clinicId = clinic.id
    admin =
      (await db.collection('profiles').findOne({
        clinic_id: clinicId,
        $or: [{ role: 'admin' }, { roles: 'admin' }],
      })) || (await db.collection('profiles').findOne({ clinic_id: clinicId }))
    doctor =
      (await db.collection('profiles').findOne({
        clinic_id: clinicId,
        $or: [{ role: 'doctor' }, { roles: 'doctor' }],
      })) || admin
    today = todayIsoTZ(clinic.timezone || clinic.settings?.timezone || 'Asia/Kolkata')
  }

  if (!admin) throw new Error('No profile found for clinic ' + clinicId)
  _resetDashboardCacheForTests()

  console.log('\n=== Explain (executionStats) ===')
  const explains = await runExplains(db, clinicId, today, doctor.id)
  for (const e of explains) console.log(JSON.stringify(e))

  console.log('\n=== Timings ===')
  const coldStart = performance.now()
  const cold = await buildDashboardStats(db, admin, clinic, {
    mode: 'full',
    skipCache: true,
    timings: true,
  })
  const coldMs = performance.now() - coldStart

  await buildDashboardStats(db, admin, clinic, { mode: 'full' })
  const warmStart = performance.now()
  const warm = await buildDashboardStats(db, admin, clinic, { mode: 'full', timings: true })
  const warmMs = performance.now() - warmStart

  _resetDashboardCacheForTests()
  const coreStart = performance.now()
  const core = await buildDashboardStats(db, admin, clinic, {
    mode: 'core',
    skipCache: true,
    timings: true,
  })
  const coreMs = performance.now() - coreStart

  _resetDashboardCacheForTests()
  const adminFull = await buildDashboardStats(db, admin, clinic, { mode: 'full', timings: true })
  const doctorFull = await buildDashboardStats(db, doctor, clinic, { mode: 'full', timings: true })

  await buildDashboardStats(db, admin, clinic, { mode: 'full' })
  invalidateDashboardRelatedCaches(clinicId, 'appointment')
  const afterInv = await buildDashboardStats(db, admin, clinic, { mode: 'full', timings: true })

  const report = {
    timings_ms: {
      cold_full_wall: Math.round(coldMs),
      cold_full_marks: cold._timings,
      warm_full_wall: Math.round(warmMs),
      warm_cache: warm._cache,
      warm_key: warm._cache_key,
      core_wall: Math.round(coreMs),
      core_marks: core._timings,
      after_invalidation_cache: afterInv._cache,
    },
    core_includes: {
      today_queue: Array.isArray(core.today_queue),
      lab_counts: core.awaiting_lab_acceptance != null,
      inventory: !!core.inventory,
      communication: !!core.communication,
      analytics_null: core.analytics == null,
      ai_null: core.ai == null,
    },
    cache_key_structure: 'dash:{clinicId}:{scopeKey}:{mode}:{clinicLocalDate}:{timezone}',
    scope_isolation_ok: adminFull._cache_key !== doctorFull._cache_key,
    admin_cache_key: adminFull._cache_key,
    doctor_cache_key: doctorFull._cache_key,
    explains,
  }
  console.log(JSON.stringify(report, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
