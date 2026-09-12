'use client'

import { cn } from '@/lib/utils'

export function Connec8Logo({ className, variant = 'mark' }) {
  if (variant === 'full') {
    return (
      <img
        src="/brand/connec8-logo.png"
        alt="Connec8"
        className={cn('w-full rounded-2xl bg-black object-contain ring-1 ring-white/10', className)}
      />
    )
  }

  return (
    <span className={cn('inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/10', className)}>
      <img src="/brand/connec8-logo.png" alt="Connec8" className="h-full w-full object-cover" />
    </span>
  )
}
