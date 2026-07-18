'use client'
import { useEffect } from 'react'

const INTERVAL_MS = 25000

export function useLiveRefresh(callback, deps = []) {
  useEffect(() => {
    const tick = () => callback()
    const id = setInterval(tick, INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const onFocus = () => tick()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
