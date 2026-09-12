'use client'

import {
  Activity,
  Bot,
  Database,
  HardDrive,
  Mail,
  Users,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const ICONS = {
  database: Database,
  online: Users,
  ai: Bot,
  storage: HardDrive,
  jobs: Zap,
  errors: AlertTriangle,
  email: Mail,
}

function statusDot(status) {
  if (status === 'healthy') return 'bg-emerald-500'
  if (status === 'warning') return 'bg-amber-500'
  return 'bg-red-500'
}

function statusSurface(status) {
  if (status === 'healthy') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  if (status === 'warning') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  return 'bg-red-500/10 text-red-600 dark:text-red-400'
}

export function SystemHealthPanel({ health, loading }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
      </div>
    )
  }

  const checks = health?.checks || []
  if (checks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          System health is unavailable right now.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {checks.map(check => {
        const Icon = ICONS[check.id] || Activity
        return (
          <div key={check.id || check.name} className="rounded-xl border border-zinc-200/60 bg-white px-4 py-3.5 shadow-[0_1px_1px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium leading-snug text-zinc-500">{check.name}</p>
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', statusSurface(check.status))}>
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', statusDot(check.status))} />
              <p className="text-[16px] font-semibold tabular-nums leading-none tracking-tight text-zinc-900">{check.value ?? '—'}</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">{check.label}</p>
          </div>
        )
      })}
    </div>
  )
}
