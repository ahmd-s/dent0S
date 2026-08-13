/**
 * Short-lived, clinic-scoped dashboard summary cache.
 * Keys always include clinic_id + scope + mode + clinic-local date + timezone.
 * Supports single-flight coalescing to prevent stampedes.
 */

const DEFAULT_TTL_MS = 20_000
const MAX_ENTRIES = 200
const cache = new Map()
const inflight = new Map()

function prune() {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (!oldest) break
    cache.delete(oldest)
  }
}

/**
 * Cache key dimensions that change the response:
 * - clinicId
 * - scopeKey (doctor:<id> | all) — doctor-scoped queues must never share
 * - mode (core | full)
 * - date (clinic-local ISO date)
 * - timezone (affects which "today" bucket)
 */
export function dashboardCacheKey({
  clinicId,
  scopeKey = 'all',
  mode = 'full',
  date,
  timezone = 'Asia/Kolkata',
}) {
  if (!clinicId) throw new Error('dashboardCacheKey requires clinicId')
  if (!date) throw new Error('dashboardCacheKey requires date')
  return `dash:${clinicId}:${scopeKey}:${mode}:${date}:${timezone}`
}

export function getDashboardCache(key, ttlMs = DEFAULT_TTL_MS) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at >= ttlMs) {
    cache.delete(key)
    return null
  }
  return hit.data
}

export function setDashboardCache(key, data) {
  cache.set(key, { data, at: Date.now() })
  prune()
}

/**
 * Get cached value or compute once. Concurrent callers for the same key
 * await the same in-flight promise (stampede protection).
 */
export async function getOrComputeDashboardCache(key, computeFn, ttlMs = DEFAULT_TTL_MS) {
  const hit = getDashboardCache(key, ttlMs)
  if (hit) return { data: hit, cache: 'hit' }

  if (inflight.has(key)) {
    const data = await inflight.get(key)
    return { data, cache: 'coalesce' }
  }

  const promise = Promise.resolve()
    .then(computeFn)
    .then(data => {
      setDashboardCache(key, data)
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise)
  const data = await promise
  return { data, cache: 'miss' }
}

/** Invalidate all dashboard summaries for a clinic (or everything). */
export function invalidateDashboardCache(clinicId = null) {
  if (!clinicId) {
    const size = cache.size
    cache.clear()
    inflight.clear()
    return { cleared: 'all', removed: size }
  }
  let removed = 0
  const prefix = `dash:${clinicId}:`
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
      removed++
    }
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key)
  }
  return { cleared: clinicId, removed }
}

export function _resetDashboardCacheForTests() {
  cache.clear()
  inflight.clear()
}

export function _inflightSizeForTests() {
  return inflight.size
}
