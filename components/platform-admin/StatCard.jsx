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
    <Card className="border-zinc-200/70 bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[10px] font-medium leading-snug text-zinc-500">{label}</p>
          {Icon && (
            <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', ICON_TONES[tone] || ICON_TONES.slate)}>
              <Icon className="h-3 w-3" />
            </span>
          )}
        </div>
        <p className={cn('text-[17px] font-semibold tabular-nums leading-none tracking-tight', muted && 'text-muted-foreground')}>
          {value}
        </p>
        {trend && (
          <p className={cn(
            'text-[10px] font-medium leading-tight',
            trend.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
            trend.direction === 'down' && 'text-red-600 dark:text-red-400',
            trend.direction === 'flat' && 'text-muted-foreground',
          )}>
            {trend.label}
          </p>
        )}
        {hint && <p className="text-[10px] leading-tight text-muted-foreground">{hint}</p>}
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
