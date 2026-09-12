'use client'
import { useEffect, useRef } from 'react'

const POLL_MS = 3000
export const CLINIC_SYNC_CHANNEL = 'dentos-clinic-sync'

/**
 * Re-runs `callback` when this clinic's data changes.
 *
 * - Polls `/api/sync` every 3s while the tab is visible (single indexed document).
 * - Same-origin tabs are notified immediately via BroadcastChannel.
 * - Hidden tabs do not poll; focus/visibility triggers an immediate check.
 */
export function useClinicSync(callback, deps = []) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const versionRef = useRef(null)

  useEffect(() => {
    let intervalId = null
    let channel = null
    try {
      channel = typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(CLINIC_SYNC_CHANNEL)
        : null
    } catch {
      channel = null
    }

    const notify = payload => {
      callbackRef.current?.(payload)
    }

    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const r = await fetch('/api/sync', { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json()
        const v = Number(d.version) || 0
        if (versionRef.current === null) {
          versionRef.current = v
          return
        }
        if (v !== versionRef.current) {
          versionRef.current = v
          notify(d)
        }
      } catch {
        // Transient network errors should not surface as toasts on a timer.
      }
    }

    const start = () => {
      if (intervalId === null) intervalId = setInterval(tick, POLL_MS)
    }
    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick()
        start()
      } else {
        stop()
      }
    }

    const onMessage = event => {
      if (event?.data) notify(event.data)
    }

    if (typeof document === 'undefined' || document.visibilityState === 'visible') start()
    tick()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', tick)
    channel?.addEventListener('message', onMessage)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', tick)
      channel?.removeEventListener('message', onMessage)
      channel?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Instant same-origin tab notification after a local mutation. */
export function publishClinicSync(reason = 'local') {
  try {
    const channel = new BroadcastChannel(CLINIC_SYNC_CHANNEL)
    channel.postMessage({ bump: true, reason })
    channel.close()
  } catch {
    // BroadcastChannel is unavailable in some embedded webviews.
  }
}
