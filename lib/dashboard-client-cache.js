/**
 * Browser-side dashboard stats cache + in-flight coalescing.
 * Paints the last good payload instantly, then refreshes in the background.
 */

const STORAGE_PREFIX = 'dentos_dash_core:'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function storageKey(clinicId) {
  return `${STORAGE_PREFIX}${clinicId || 'unknown'}:${todayKey()}`
}

export function readCachedDashboardStats(clinicId) {
  if (typeof window === 'undefined' || !clinicId) return null
  try {
    const raw = sessionStorage.getItem(storageKey(clinicId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function writeCachedDashboardStats(clinicId, data) {
  if (typeof window === 'undefined' || !clinicId || !data) return
  try {
    sessionStorage.setItem(storageKey(clinicId), JSON.stringify(data))
  } catch { /* quota / private mode */ }
}

export function clearCachedDashboardStats() {
  if (typeof window === 'undefined') return
  try {
    const keys = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    keys.forEach(key => sessionStorage.removeItem(key))
  } catch { /* noop */ }
}

let coreInflight = null

export function fetchDashboardCore() {
  if (coreInflight) return coreInflight
  coreInflight = fetch('/api/dashboard/stats?mode=core', {
    credentials: 'include',
    cache: 'no-store',
  })
    .then(async r => {
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not load dashboard')
      return d
    })
    .finally(() => {
      coreInflight = null
    })
  return coreInflight
}

export function prefetchDashboardCore() {
  if (typeof window === 'undefined') return
  fetchDashboardCore().catch(() => { /* dashboard page surfaces errors */ })
}
