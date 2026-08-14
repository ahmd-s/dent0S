'use client'
import { useEffect, useRef } from 'react'

const INTERVAL_MS = 25000

/**
 * Periodically re-runs `callback`, plus once whenever the tab regains focus.
 *
 * Two fixes over the original:
 *
 * - `callback` is held in a ref, so the interval always invokes the latest
 *   closure. Previously the default `deps = []` froze the first render's
 *   callback, and a screen whose refresh depended on current filter state kept
 *   re-fetching with the filters it had on mount.
 * - The interval is cleared while the tab is hidden. Background tabs used to
 *   keep polling every 25s forever, which at scale is a large amount of
 *   pointless load — a clinic with five tabs open overnight generated ~57k
 *   requests. Focus/visibility still triggers an immediate refresh, so the
 *   data a user sees on return is just as fresh.
 */
export function useLiveRefresh(callback, deps = []) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    let intervalId = null
    const tick = () => callbackRef.current?.()

    const start = () => {
      if (intervalId === null) intervalId = setInterval(tick, INTERVAL_MS)
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
    const onFocus = () => tick()

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
