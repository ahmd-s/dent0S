'use client'

import { useEffect, useState } from 'react'

/**
 * Returns `value` after it has stayed unchanged for `delayMs`.
 *
 * Search inputs were wired straight into a fetch effect, so typing "Rajesh"
 * issued six regex queries against `patients` and the responses could resolve
 * out of order. Debouncing the value collapses a burst of keystrokes into one
 * request.
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (value === debounced) return
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
    // `debounced` is intentionally excluded: including it would restart the
    // timer on every settle and re-fire the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs])

  return debounced
}

export default useDebouncedValue
