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

export function StatCard({ label, value, hint, icon: Icon, tone = 'slate', muted = false }) {
  return (
    <Card className="border-border/70 bg-card/60 shadow-sm transition-colors hover:border-border">
      <CardContent className="flex items-start gap-4 p-5">
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ICON_TONES[tone] || ICON_TONES.slate)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn('text-2xl font-semibold tabular-nums leading-none', muted && 'text-muted-foreground')}>
            {value}
          </p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function DetailCard({ label, value, hint, className }) {
  return (
    <div className={cn('rounded-xl border border-border/70 bg-card/50 p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 break-words text-sm font-medium text-foreground">{value ?? '—'}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
