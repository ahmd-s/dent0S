import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('clinic sync wiring', () => {
  it('invalidation helper bumps the clinic version clock', () => {
    const src = readFileSync(path.join(root, 'lib/dashboard-invalidation.js'), 'utf8')
    assert.ok(src.includes('bumpClinicSyncBackground'))
    assert.ok(src.includes('clinic-sync'))
  })

  it('public online booking invalidates clinic dashboards', () => {
    const src = readFileSync(path.join(root, 'app/api/public/clinic/[slug]/book/route.js'), 'utf8')
    assert.ok(src.includes('dashboard-invalidation'))
    assert.ok(src.includes('invalidateClinicDashboard'))
  })

  it('sync route is a point-read of clinic_sync', () => {
    const src = readFileSync(path.join(root, 'app/api/sync/route.js'), 'utf8')
    assert.ok(src.includes('getClinicSync'))
    assert.ok(src.includes('requireUser'))
  })

  it('index spec includes clinic_sync unique clinic_id', () => {
    const src = readFileSync(path.join(root, 'lib/setup-indexes.js'), 'utf8')
    assert.ok(src.includes("collection: 'clinic_sync'"))
  })
})
