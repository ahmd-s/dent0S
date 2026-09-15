'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { semanticStatColor } from '@/lib/ui-status'

export default function StatCard({ label, val, sub, icon: Icon, color, href, compact = false, className }) {
  const accent = semanticStatColor(color, val)
  const inner = (
    <Card
      className={cn(
        'bg-card border-border/70 h-full rounded-xl shadow-none',
        compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5 min-h-[96px]',
        href && 'hover:border-border hover:bg-muted/30 transition-colors cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className={cn('text-muted-foreground leading-snug', compact ? 'text-xs line-clamp-1' : 'text-xs md:text-sm line-clamp-2')}>
            {label}
          </div>
          <div
            className={cn('font-semibold leading-none tabular-nums text-foreground', compact ? 'text-xl sm:text-2xl mt-1.5' : 'text-2xl md:text-3xl mt-2')}
            style={accent ? { color: accent } : undefined}
          >
            {val ?? '—'}
          </div>
          {sub && (
            <div className={cn('text-muted-foreground leading-snug', compact ? 'text-[11px] mt-1 line-clamp-1' : 'text-xs mt-1.5 line-clamp-2')}>
              {sub}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-lg bg-muted/70 flex items-center justify-center flex-shrink-0 text-muted-foreground', compact ? 'w-8 h-8' : 'w-9 h-9')}>
            <Icon className={compact ? 'w-4 h-4' : 'w-4 h-4'} style={accent ? { color: accent } : undefined} />
          </div>
        )}
      </div>
    </Card>
  )
  if (href) return <Link href={href} className="min-w-0 block h-full">{inner}</Link>
  return <div className="min-w-0 h-full">{inner}</div>
}
