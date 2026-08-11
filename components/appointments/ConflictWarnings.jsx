'use client'

import { AlertTriangle } from 'lucide-react'

export default function ConflictWarnings({ conflicts = [], warnings = [], className = '' }) {
  if (!conflicts.length && !warnings.length) return null
  return (
    <div className={`space-y-1.5 ${className}`}>
      {conflicts.map((c, i) => (
        <div key={`c-${i}`} className="flex items-start gap-2 p-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 dark:bg-red-950/20 dark:border-red-900 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{c.message}</span>
        </div>
      ))}
      {warnings.map((w, i) => (
        <div key={`w-${i}`} className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  )
}
