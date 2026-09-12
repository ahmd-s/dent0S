'use client'

import { cn } from '@/lib/utils'

export function Connec8Logo({ className, size = 36 }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-black ring-1 ring-white/10',
        className
      )}
      style={{ width: size, height: size, padding: Math.max(5, Math.round(size * 0.14)) }}
    >
      <img
        src="/brand/connec8-logo.png"
        alt="Connec8"
        className="h-full w-full object-contain"
      />
    </span>
  )
}

/**
 * Compact product lockup: mark + DentOS, with a quiet secondary line.
 * Logo stays square and is vertically centered with the product name.
 */
export function BrandLockup({
  className,
  subtitle = 'Super Admin',
  inverted = true,
  size = 32,
}) {
  return (
    <div className={cn('grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-3', className)}>
      <Connec8Logo size={size} className="col-start-1 row-start-1" />
      <span
        className={cn(
          'col-start-2 row-start-1 self-center truncate text-[14px] font-semibold leading-none tracking-[-0.02em]',
          inverted ? 'text-white' : 'text-zinc-900'
        )}
      >
        DentOS
      </span>
      {subtitle ? (
        <span
          className={cn(
            'col-start-2 row-start-2 mt-1 truncate text-[11px] font-medium leading-none tracking-wide',
            inverted ? 'text-white/40' : 'text-zinc-500'
          )}
        >
          {subtitle}
        </span>
      ) : null}
    </div>
  )
}
