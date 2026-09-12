import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canClinicStaffLogin,
  canPermanentlyDelete,
  confirmationMatchesClinicName,
  daysSince,
  deriveConsoleStatus,
  filterConsoleClinics,
  inactivityBucket,
  paginateRows,
  sortConsoleClinics,
  trendFromCounts,
} from '../platform-admin-console-core.js'

describe('deriveConsoleStatus', () => {
  it('marks soft-deleted clinics as deleted first', () => {
    assert.equal(deriveConsoleStatus({ deleted_at: new Date(), is_active: false, billing_status: 'trial' }), 'deleted')
  })

  it('marks deactivated clinics inactive even if billed as trial', () => {
    assert.equal(deriveConsoleStatus({ is_active: false, billing_status: 'trial' }), 'inactive')
  })

  it('marks emergency lock and blocked access as suspended', () => {
    assert.equal(deriveConsoleStatus({ is_active: true, subscription_status: 'blocked' }), 'suspended')
    assert.equal(deriveConsoleStatus({ is_active: true, emergency_locked_at: new Date() }), 'suspended')
  })

  it('marks trial billing as trial when access is open', () => {
    assert.equal(deriveConsoleStatus({ is_active: true, billing_status: 'trial', subscription_status: 'active' }), 'trial')
  })

  it('defaults to active', () => {
    assert.equal(deriveConsoleStatus({ is_active: true, billing_status: 'active', subscription_status: 'active' }), 'active')
  })
})

describe('inactivityBucket', () => {
  it('returns null under two days', () => {
    assert.equal(inactivityBucket(null), null)
    assert.equal(inactivityBucket(1), null)
  })

  it('buckets 2 / 14 / 30 / 90+ days', () => {
    assert.equal(inactivityBucket(2).id, '2')
    assert.equal(inactivityBucket(14).label, '14 Days')
    assert.equal(inactivityBucket(45).label, '30 Days')
    assert.equal(inactivityBucket(120).label, '90+ Days')
  })
})

describe('canPermanentlyDelete', () => {
  it('blocks active clinics', () => {
    const result = canPermanentlyDelete({ is_active: true, name: 'Acme Dental' })
    assert.equal(result.ok, false)
    assert.match(result.error, /inactive/i)
  })

  it('allows only inactive clinics', () => {
    assert.equal(canPermanentlyDelete({ is_active: false, name: 'Acme Dental' }).ok, true)
  })

  it('rejects already deleted clinics', () => {
    assert.equal(canPermanentlyDelete({ is_active: false, deleted_at: new Date() }).ok, false)
  })
})

describe('confirmationMatchesClinicName', () => {
  it('requires an exact trimmed match', () => {
    assert.equal(confirmationMatchesClinicName('Acme Dental', 'Acme Dental'), true)
    assert.equal(confirmationMatchesClinicName('Acme Dental', ' acme dental '), false)
    assert.equal(confirmationMatchesClinicName('Acme Dental', 'Acme'), false)
  })
})

describe('filter, sort, paginate', () => {
  const rows = [
    { id: '1', name: 'Zeta', owner_email: 'z@x.com', console_status: 'active', plan_type: 'monthly', days_since_last_activity: 0, created_at: '2026-01-01', doctor_count: 2 },
    { id: '2', name: 'Alpha', owner_email: 'a@x.com', console_status: 'inactive', plan_type: 'free', days_since_last_activity: 14, created_at: '2026-03-01', doctor_count: 5 },
    { id: '3', name: 'Beta', owner_email: 'b@x.com', console_status: 'deleted', plan_type: 'yearly', days_since_last_activity: 90, created_at: '2026-02-01', doctor_count: 1 },
    { id: '4', name: 'Trial Clinic', owner_email: 't@x.com', console_status: 'trial', plan_type: 'free', days_since_last_activity: 2, created_at: '2026-04-01', doctor_count: 0 },
  ]

  it('hides deleted clinics by default and searches owner email', () => {
    const filtered = filterConsoleClinics(rows, { q: 'a@x.com' })
    assert.deepEqual(filtered.map(r => r.id), ['2'])
  })

  it('can include deleted when requested', () => {
    const filtered = filterConsoleClinics(rows, { status: 'deleted', includeDeleted: true })
    assert.equal(filtered.length, 1)
    assert.equal(filtered[0].id, '3')
  })

  it('treats inactivity filter as a minimum day threshold', () => {
    const filtered = filterConsoleClinics(rows, { inactivity: '14' })
    assert.deepEqual(filtered.map(r => r.id), ['2'])
  })

  it('sorts by name ascending', () => {
    const sorted = sortConsoleClinics(rows, 'name', 'asc')
    assert.deepEqual(sorted.map(r => r.name), ['Alpha', 'Beta', 'Trial Clinic', 'Zeta'])
  })

  it('paginates without overflowing the last page', () => {
    const page = paginateRows(rows, 9, 2)
    assert.equal(page.page, 2)
    assert.equal(page.pageCount, 2)
    assert.equal(page.rows.length, 2)
  })
})

describe('trendFromCounts', () => {
  it('computes percent change', () => {
    assert.equal(trendFromCounts(12, 10).label, '+20%')
    assert.equal(trendFromCounts(5, 10).direction, 'down')
    assert.equal(trendFromCounts(4, 0).direction, 'up')
  })
})

describe('daysSince', () => {
  it('returns whole days from a past date', () => {
    const now = Date.parse('2026-09-12T00:00:00Z')
    assert.equal(daysSince('2026-09-10T00:00:00Z', now), 2)
    assert.equal(daysSince(null, now), null)
  })
})

describe('canClinicStaffLogin', () => {
  it('blocks deactivated, deleted, and access-paused clinics', () => {
    assert.equal(canClinicStaffLogin({ is_active: true, subscription_status: 'active' }).ok, true)
    assert.equal(canClinicStaffLogin({ is_active: false }).ok, false)
    assert.equal(canClinicStaffLogin({ is_active: true, subscription_status: 'blocked' }).ok, false)
    assert.equal(canClinicStaffLogin({ deleted_at: new Date() }).deleted, true)
    assert.equal(canClinicStaffLogin(null).ok, false)
  })
})
