'use client'

import { useEffect, useState } from 'react'

/** Only mount tab content after first activation — lazy load data inside panels. */
export default function LazyTabPanel({ tabId, activeTab, children, className = '' }) {
  const [mounted, setMounted] = useState(activeTab === tabId)

  useEffect(() => {
    if (activeTab === tabId) setMounted(true)
  }, [activeTab, tabId])

  if (!mounted) return null
  return <div className={className}>{children}</div>
}
