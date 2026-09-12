/**
 * Pure Super Admin console helpers — no DB, no Next aliases.
 * Safe to unit-test with node:test.
 */

/** @typedef {'active' | 'inactive' | 'trial' | 'suspended' | 'deleted'} ConsoleStatus */

export const APP_VERSION = '1.0.0'

export const CONSOLE_STATUSES = /** @type {const} */ (['active', 'inactive', 'trial', 'suspended', 'deleted'])

export const CONSOLE_STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  trial: 'Trial',
  suspended: 'Suspended',
  deleted: 'Deleted',
}

export const CONSOLE_STATUS_TONES = {
  active: 'green',
  inactive: 'slate',
  trial: 'blue',
  suspended: 'amber',
  deleted: 'red',
}

export const PLAN_OPTIONS = ['free', 'trial', 'monthly', 'yearly', 'starter', 'professional', 'enterprise']

export const BULK_ACTIONS = ['activate', 'deactivate', 'extend_trial', 'send_email', 'export', 'delete']

/**
 * @param {object | null | undefined} row
 * @returns {ConsoleStatus}
 */
export function deriveConsoleStatus(row) {
  if (!row) return 'inactive'
  if (row.deleted_at || row.permanently_deleted_at) return 'deleted'
  if (row.is_active === false) return 'inactive'
  if (
    row.emergency_locked_at ||
    row.subscription_status === 'blocked' ||
    row.platform_status === 'locked'
  ) {
    return 'suspended'
  }
  if (row.billing_status === 'trial') return 'trial'
  return 'active'
}

/**
 * @param {Date | string | number | null | undefined} date
 * @param {number} [now]
 * @returns {number | null}
 */
export function daysSince(date, now = Date.now()) {
  if (!date) return null
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / (1000 * 60 * 60 * 24)))
}

/**
 * @param {number | null | undefined} days
 * @returns {{ id: string, label: string } | null}
 */
export function inactivityBucket(days) {
  if (days == null || days < 2) return null
  if (days >= 90) return { id: '90', label: '90+ Days' }
  if (days >= 30) return { id: '30', label: '30 Days' }
  if (days >= 14) return { id: '14', label: '14 Days' }
  return { id: '2', label: '2 Days' }
}

/**
 * @param {object | null | undefined} row
 * @returns {{ ok: boolean, error?: string }}
 */
export function canPermanentlyDelete(row) {
  if (!row) return { ok: false, error: 'Clinic not found' }
  if (row.deleted_at || row.permanently_deleted_at) {
    return { ok: false, error: 'Clinic is already deleted' }
  }
  if (row.is_active !== false) {
    return { ok: false, error: 'Only inactive clinics can be permanently deleted. Deactivate the clinic first.' }
  }
  return { ok: true }
}

/**
 * @param {string} clinicName
 * @param {string} typed
 */
export function confirmationMatchesClinicName(clinicName, typed) {
  return String(typed || '').trim() === String(clinicName || '').trim()
}

/**
 * @param {number} current
 * @param {number} previous
 */
export function trendFromCounts(current, previous) {
  const cur = Number(current) || 0
  const prev = Number(previous) || 0
  if (prev === 0) {
    return {
      value: cur > 0 ? 100 : 0,
      direction: cur > 0 ? 'up' : 'flat',
      label: cur > 0 ? 'New' : 'No change',
    }
  }
  const pct = Math.round(((cur - prev) / prev) * 100)
  return {
    value: Math.abs(pct),
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
    label: pct === 0 ? 'No change' : `${pct > 0 ? '+' : ''}${pct}%`,
  }
}

const SORT_ACCESSORS = {
  name: r => (r.name || '').toLowerCase(),
  owner: r => (r.owner_name || '').toLowerCase(),
  email: r => (r.owner_email || '').toLowerCase(),
  phone: r => r.phone || '',
  plan: r => (r.plan_type || '').toLowerCase(),
  status: r => r.console_status || '',
  last_active: r => (r.last_activity ? new Date(r.last_activity).getTime() : 0),
  last_login: r => (r.last_staff_login ? new Date(r.last_staff_login).getTime() : 0),
  created_at: r => (r.created_at ? new Date(r.created_at).getTime() : 0),
  doctors: r => r.doctor_count || 0,
  patients: r => r.patient_count || 0,
  version: r => (r.version || '').toLowerCase(),
  inactivity: r => r.days_since_last_activity ?? -1,
}

export function sortConsoleClinics(rows, sort = 'created_at', order = 'desc') {
  const getter = SORT_ACCESSORS[sort] || SORT_ACCESSORS.created_at
  const dir = order === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = getter(a)
    const bv = getter(b)
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return (a.name || '').localeCompare(b.name || '')
  })
}

export function filterConsoleClinics(rows, {
  q = '',
  status = 'all',
  plan = 'all',
  inactivity = 'all',
  includeDeleted = false,
} = {}) {
  const query = String(q || '').trim().toLowerCase()
  return rows.filter(r => {
    if (!includeDeleted && r.console_status === 'deleted') return false
    if (status && status !== 'all' && r.console_status !== status) return false
    if (plan && plan !== 'all' && (r.plan_type || '') !== plan) return false
    if (inactivity && inactivity !== 'all') {
      const min = Number(inactivity)
      if (!Number.isFinite(min) || (r.days_since_last_activity ?? -1) < min) return false
    }
    if (query) {
      const hay = [r.name, r.owner_name, r.owner_email, r.phone, r.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(query)) return false
    }
    return true
  })
}

export function paginateRows(rows, page = 1, pageSize = 25) {
  const size = Math.min(100, Math.max(1, Number(pageSize) || 25))
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / size) || 1)
  const p = Math.min(pageCount, Math.max(1, Number(page) || 1))
  const start = (p - 1) * size
  return {
    rows: rows.slice(start, start + size),
    total,
    page: p,
    pageSize: size,
    pageCount,
  }
}

export function parseClinicListQuery(searchParams) {
  return {
    q: searchParams.get('q') || '',
    status: searchParams.get('status') || 'all',
    plan: searchParams.get('plan') || 'all',
    inactivity: searchParams.get('inactivity') || 'all',
    sort: searchParams.get('sort') || 'created_at',
    order: searchParams.get('order') === 'asc' ? 'asc' : 'desc',
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || 25),
    includeDeleted: searchParams.get('include_deleted') === '1',
    all: searchParams.get('all') === '1',
  }
}

export function summarizeConsoleKpis(rows) {
  const live = rows.filter(r => r.console_status !== 'deleted')
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  let inactive = 0
  let trial = 0
  let paid = 0
  let expired = 0
  let active = 0
  let newThisMonth = 0
  let newLastMonth = 0
  let suspended = 0

  for (const r of live) {
    if (r.console_status === 'inactive') inactive += 1
    if (r.console_status === 'trial') trial += 1
    if (r.console_status === 'active') active += 1
    if (r.console_status === 'suspended') suspended += 1
    if (r.is_paid) paid += 1
    if (r.subscription_expired) expired += 1
    const created = r.created_at ? new Date(r.created_at) : null
    if (created && created >= monthStart) newThisMonth += 1
    else if (created && created >= lastMonthStart && created < monthStart) newLastMonth += 1
  }

  return {
    total: live.length,
    active,
    inactive,
    trial,
    paid,
    expired,
    suspended,
    new_this_month: newThisMonth,
    new_last_month: newLastMonth,
    deleted: rows.length - live.length,
  }
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function canClinicStaffLogin(clinic) {
  if (!clinic) return { ok: false, deleted: true }
  if (clinic.deleted_at || clinic.permanently_deleted_at) return { ok: false, deleted: true }
  if (clinic.is_active === false) return { ok: false, deleted: false }
  if (clinic.subscription_status === 'blocked') return { ok: false, deleted: false }
  return { ok: true, deleted: false }
}
