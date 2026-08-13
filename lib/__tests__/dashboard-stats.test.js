/**
 * Dashboard cache safety, stampede protection, and invalidation coverage tests.
 * Avoids Next `@/` path aliases by testing cache + scanning mutation routes.
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  dashboardCacheKey,
  getDashboardCache,
  setDashboardCache,
  getOrComputeDashboardCache,
  invalidateDashboardCache,
  _resetDashboardCacheForTests,
  _inflightSizeForTests,
} from '../dashboard-cache.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('dashboard cache key dimensions', () => {
  beforeEach(() => _resetDashboardCacheForTests())

  it('includes clinic, scope, mode, date, and timezone', () => {
    const key = dashboardCacheKey({
      clinicId: 'c1',
      scopeKey: 'doctor:u1',
      mode: 'core',
      date: '2026-08-12',
      timezone: 'Asia/Kolkata',
    })
    assert.equal(key, 'dash:c1:doctor:u1:core:2026-08-12:Asia/Kolkata')
  })

  it('isolates doctor scopes from clinic-wide all scope', () => {
    const allKey = dashboardCacheKey({ clinicId: 'c1', scopeKey: 'all', mode: 'full', date: '2026-08-12', timezone: 'Asia/Kolkata' })
    const docKey = dashboardCacheKey({ clinicId: 'c1', scopeKey: 'doctor:u1', mode: 'full', date: '2026-08-12', timezone: 'Asia/Kolkata' })
    setDashboardCache(allKey, { today_queue: [1, 2, 3] })
    setDashboardCache(docKey, { today_queue: [1] })
    assert.notEqual(allKey, docKey)
    assert.equal(getDashboardCache(allKey).today_queue.length, 3)
    assert.equal(getDashboardCache(docKey).today_queue.length, 1)
  })

  it('isolates core vs full mode and timezones', () => {
    const core = dashboardCacheKey({ clinicId: 'c1', scopeKey: 'all', mode: 'core', date: '2026-08-12', timezone: 'Asia/Kolkata' })
    const full = dashboardCacheKey({ clinicId: 'c1', scopeKey: 'all', mode: 'full', date: '2026-08-12', timezone: 'Asia/Kolkata' })
    const utc = dashboardCacheKey({ clinicId: 'c1', scopeKey: 'all', mode: 'full', date: '2026-08-12', timezone: 'UTC' })
    assert.notEqual(core, full)
    assert.notEqual(full, utc)
  })

  it('isolates clinics on invalidate', () => {
    const a = dashboardCacheKey({ clinicId: 'a', scopeKey: 'all', mode: 'full', date: '2026-08-12', timezone: 'Asia/Kolkata' })
    const b = dashboardCacheKey({ clinicId: 'b', scopeKey: 'all', mode: 'full', date: '2026-08-12', timezone: 'Asia/Kolkata' })
    setDashboardCache(a, { clinic: 'a' })
    setDashboardCache(b, { clinic: 'b' })
    invalidateDashboardCache('a')
    assert.equal(getDashboardCache(a), null)
    assert.equal(getDashboardCache(b).clinic, 'b')
  })
})

describe('stampede protection', () => {
  beforeEach(() => _resetDashboardCacheForTests())

  it('coalesces concurrent computes for the same key', async () => {
    const key = dashboardCacheKey({ clinicId: 'c1', scopeKey: 'all', mode: 'full', date: '2026-08-12', timezone: 'Asia/Kolkata' })
    let calls = 0
    const compute = async () => {
      calls += 1
      await new Promise(r => setTimeout(r, 40))
      return { n: calls }
    }

    const [a, b, c] = await Promise.all([
      getOrComputeDashboardCache(key, compute),
      getOrComputeDashboardCache(key, compute),
      getOrComputeDashboardCache(key, compute),
    ])

    assert.equal(calls, 1)
    assert.equal(a.data.n, 1)
    assert.equal(b.data.n, 1)
    assert.equal(c.data.n, 1)
    assert.equal(_inflightSizeForTests(), 0)
  })
})

describe('centralized invalidation coverage', () => {
  it('helper lists all mutation reason categories', () => {
    const src = readFileSync(path.join(root, 'lib/dashboard-invalidation.js'), 'utf8')
    for (const reason of [
      'appointment', 'visit', 'invoice', 'patient', 'followup',
      'lab_case', 'inventory', 'communication', 'task',
    ]) {
      assert.ok(src.includes(`'${reason}'`), `missing reason ${reason}`)
    }
    assert.ok(src.includes('export function invalidateClinicDashboard'))
  })

  it('mutation routes call the centralized invalidation helper', () => {
    const files = [
      ['appointment', 'app/api/appointments/route.js'],
      ['appointment', 'app/api/appointments/[id]/route.js'],
      ['appointment', 'app/api/appointments/flow/route.js'],
      ['visit', 'app/api/visits/route.js'],
      ['visit', 'app/api/visits/[id]/route.js'],
      ['invoice', 'app/api/invoices/[id]/route.js'],
      ['patient', 'app/api/patients/route.js'],
      ['patient/followup', 'app/api/patients/[id]/route.js'],
      ['lab_case', 'app/api/lab-cases/route.js'],
      ['lab_case', 'app/api/lab-cases/[id]/route.js'],
      ['lab_case', 'app/api/lab-cases/flow/route.js'],
      ['inventory', 'app/api/inventory/route.js'],
      ['inventory', 'app/api/inventory/[id]/route.js'],
      ['inventory', 'app/api/inventory/stock-in/route.js'],
      ['inventory', 'app/api/inventory/stock-out/route.js'],
      ['inventory', 'app/api/inventory/consume/route.js'],
      ['inventory', 'app/api/inventory/flow/route.js'],
      ['inventory', 'app/api/inventory/purchases/route.js'],
      ['inventory', 'app/api/inventory/purchases/[id]/route.js'],
      ['communication', 'app/api/communication/messages/route.js'],
      ['communication', 'app/api/communication/messages/[id]/mark-sent/route.js'],
      ['communication', 'app/api/communication/messages/[id]/cancel/route.js'],
      ['communication', 'app/api/communication/reminders/route.js'],
    ]

    const missing = []
    for (const [category, rel] of files) {
      const src = readFileSync(path.join(root, rel), 'utf8')
      const wired = src.includes('dashboard-invalidation') && (
        src.includes('invalidateClinicDashboard') || src.includes('invalidateDashboardRelatedCaches')
      )
      if (!wired) missing.push(`${category}:${rel}`)
    }
    assert.deepEqual(missing, [])
  })

  it('stats route restricts nocache/timings outside debug', () => {
    const src = readFileSync(path.join(root, 'app/api/dashboard/stats/route.js'), 'utf8')
    assert.ok(src.includes('allowDashboardDebug'))
    assert.ok(src.includes('DASHBOARD_PERF_DEBUG'))
    assert.ok(src.includes("NODE_ENV !== 'production'"))
  })
})
