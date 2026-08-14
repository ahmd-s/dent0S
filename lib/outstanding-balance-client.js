'use client'

/**
 * Coalesces outstanding-balance lookups across every rendered balance badge.
 *
 * Each badge used to issue its own request on mount, so a 20-row appointment
 * queue produced 20 round-trips. Requests raised within the same tick are
 * collected and sent as a single batch, and results are cached briefly so
 * navigating back to a list doesn't re-fetch.
 */

const BATCH_WINDOW_MS = 20
const CACHE_TTL_MS = 30_000
const MAX_BATCH_IDS = 100

const cache = new Map()
const pending = new Map()
let queue = new Set()
let timer = null

function cached(patientId) {
  const hit = cache.get(patientId)
  if (!hit) return undefined
  if (Date.now() - hit.at >= CACHE_TTL_MS) {
    cache.delete(patientId)
    return undefined
  }
  return hit.value
}

async function flush() {
  timer = null
  const ids = [...queue]
  queue = new Set()
  if (ids.length === 0) return

  for (let i = 0; i < ids.length; i += MAX_BATCH_IDS) {
    const chunk = ids.slice(i, i + MAX_BATCH_IDS)
    try {
      const params = new URLSearchParams({ patient_ids: chunk.join(',') })
      const res = await fetch(`/api/patients/outstanding-balance?${params}`)
      const data = res.ok ? await res.json() : null
      const balances = data?.balances || {}
      for (const id of chunk) {
        const value = balances[id] ?? 0
        cache.set(id, { value, at: Date.now() })
        pending.get(id)?.forEach(resolve => resolve(value))
        pending.delete(id)
      }
    } catch {
      // Resolve rather than reject: a failed lookup should hide the badge, not
      // surface an error in an otherwise healthy list.
      for (const id of chunk) {
        pending.get(id)?.forEach(resolve => resolve(0))
        pending.delete(id)
      }
    }
  }
}

export function getOutstandingBalance(patientId) {
  if (!patientId) return Promise.resolve(0)

  const hit = cached(patientId)
  if (hit !== undefined) return Promise.resolve(hit)

  return new Promise(resolve => {
    if (!pending.has(patientId)) pending.set(patientId, [])
    pending.get(patientId).push(resolve)
    queue.add(patientId)
    if (timer === null) timer = setTimeout(flush, BATCH_WINDOW_MS)
  })
}

/** Call after a payment so badges reflect the new balance. */
export function invalidateOutstandingBalance(patientId = null) {
  if (patientId) cache.delete(patientId)
  else cache.clear()
}
