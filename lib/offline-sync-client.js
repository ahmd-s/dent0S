/**
 * Sprint 19 — Offline-ready write queue (PWA-ready foundation).
 * Queues pending writes, auto-retry on reconnect, conflict detection, sync status.
 */

const QUEUE_KEY = 'dentos_offline_queue'
const SYNC_STATUS_KEY = 'dentos_sync_status'
const MAX_RETRIES = 5
const RETRY_INTERVAL_MS = 10000

export const SYNC_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  SYNCING: 'syncing',
  CONFLICT: 'conflict',
  READ_ONLY: 'read_only',
}

/** Detect online status. */
export function isOnline() {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}

/** Get current sync status. */
export function getSyncStatus() {
  if (typeof window === 'undefined') return SYNC_STATUS.ONLINE
  if (!isOnline()) return SYNC_STATUS.OFFLINE
  try {
    return localStorage.getItem(SYNC_STATUS_KEY) || SYNC_STATUS.ONLINE
  } catch {
    return SYNC_STATUS.ONLINE
  }
}

function setSyncStatus(status) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SYNC_STATUS_KEY, status)
    window.dispatchEvent(new CustomEvent('dentos:sync-status', { detail: status }))
  } catch { /* ignore */ }
}

/** Read offline queue. */
export function getOfflineQueue() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch { /* ignore */ }
}

/** Enqueue a pending write. */
export function enqueueOfflineWrite({ url, method = 'POST', body, headers = {}, idempotencyKey }) {
  const queue = getOfflineQueue()
  const entry = {
    id: idempotencyKey || `wq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    url,
    method,
    body,
    headers,
    createdAt: new Date().toISOString(),
    retries: 0,
    status: 'pending',
  }
  queue.push(entry)
  saveQueue(queue)
  setSyncStatus(SYNC_STATUS.OFFLINE)
  return entry
}

/** Remove completed entry from queue. */
export function dequeueWrite(id) {
  const queue = getOfflineQueue().filter(e => e.id !== id)
  saveQueue(queue)
  if (queue.length === 0 && isOnline()) setSyncStatus(SYNC_STATUS.ONLINE)
}

/** Process queue — retry pending writes. */
export async function processOfflineQueue({ onConflict, onError } = {}) {
  if (!isOnline()) return { processed: 0, failed: 0 }
  const queue = getOfflineQueue()
  if (!queue.length) {
    setSyncStatus(SYNC_STATUS.ONLINE)
    return { processed: 0, failed: 0 }
  }

  setSyncStatus(SYNC_STATUS.SYNCING)
  let processed = 0
  let failed = 0

  for (const entry of queue.filter(e => e.status === 'pending')) {
    try {
      const csrfToken = typeof document !== 'undefined'
        ? document.cookie.split('; ').find(c => c.startsWith('dentos_csrf='))?.split('=')[1]
        : null

      const res = await fetch(entry.url, {
        method: entry.method,
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          ...entry.headers,
        },
        body: JSON.stringify(entry.body),
        credentials: 'include',
      })

      if (res.status === 409) {
        entry.status = 'conflict'
        setSyncStatus(SYNC_STATUS.CONFLICT)
        onConflict?.(entry, await res.json().catch(() => ({})))
        failed++
        continue
      }

      if (!res.ok) {
        entry.retries += 1
        if (entry.retries >= MAX_RETRIES) {
          entry.status = 'failed'
          failed++
        }
        onError?.(entry, res.status)
        continue
      }

      dequeueWrite(entry.id)
      processed++
    } catch {
      entry.retries += 1
      if (entry.retries >= MAX_RETRIES) entry.status = 'failed'
      failed++
    }
  }

  saveQueue(getOfflineQueue())
  if (failed === 0 && processed > 0) setSyncStatus(SYNC_STATUS.ONLINE)
  else if (!isOnline()) setSyncStatus(SYNC_STATUS.OFFLINE)
  else if (getOfflineQueue().some(e => e.status === 'conflict')) setSyncStatus(SYNC_STATUS.CONFLICT)
  else if (getOfflineQueue().length > 0) setSyncStatus(SYNC_STATUS.OFFLINE)

  return { processed, failed, remaining: getOfflineQueue().length }
}

/** Fetch wrapper with offline queue fallback. */
export async function fetchWithOfflineQueue(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (!isMutation || isOnline()) {
    try {
      const res = await fetch(url, { ...options, credentials: 'include' })
      return res
    } catch (error) {
      if (isMutation && !isOnline()) {
        const body = options.body ? JSON.parse(options.body) : {}
        enqueueOfflineWrite({ url, method, body })
        return { ok: false, status: 0, offline: true, json: async () => ({ queued: true }) }
      }
      throw error
    }
  }

  const body = options.body ? JSON.parse(options.body) : {}
  enqueueOfflineWrite({ url, method, body })
  return { ok: false, status: 0, offline: true, json: async () => ({ queued: true }) }
}

/** Start auto-sync on reconnect. */
export function startOfflineSyncListener() {
  if (typeof window === 'undefined') return () => {}

  const onOnline = () => processOfflineQueue()
  window.addEventListener('online', onOnline)

  const interval = setInterval(() => {
    if (isOnline() && getOfflineQueue().length > 0) processOfflineQueue()
  }, RETRY_INTERVAL_MS)

  return () => {
    window.removeEventListener('online', onOnline)
    clearInterval(interval)
  }
}

export { QUEUE_KEY, MAX_RETRIES }
