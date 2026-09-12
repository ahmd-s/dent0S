'use client'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const ICON_TONES = {
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  red: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
  slate: 'bg-muted text-muted-foreground',
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'slate', muted = false, trend }) {
  return (
    <Card className="border-zinc-200/60 bg-white shadow-[0_1px_1px_rgba(15,23,42,0.04)]">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-[11px] font-medium leading-snug text-zinc-500">{label}</p>
          {Icon && (
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', ICON_TONES[tone] || ICON_TONES.slate)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <p className={cn('text-[22px] font-semibold tabular-nums leading-none tracking-tight text-zinc-900', muted && 'text-muted-foreground')}>
          {value}
        </p>
        {trend && (
          <p className={cn(
            'text-[11px] font-medium leading-tight',
            trend.direction === 'up' && 'text-emerald-600',
            trend.direction === 'down' && 'text-red-600',
            trend.direction === 'flat' && 'text-zinc-400',
          )}>
            {trend.label}
          </p>
        )}
        {hint && <p className="text-[11px] leading-tight text-zinc-400">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function DetailCard({ label, value, hint, className }) {
  return (
    <div className={cn('rounded-xl border border-border/70 bg-card/50 p-4', className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 break-words text-sm font-medium text-foreground">{value ?? '—'}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
