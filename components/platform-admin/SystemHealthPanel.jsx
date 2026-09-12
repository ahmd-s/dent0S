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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {checks.map(check => {
        const Icon = ICONS[check.id] || Activity
        return (
          <Card key={check.id || check.name} className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {check.name}
              </CardTitle>
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', statusSurface(check.status))}>
                <Icon className="h-3.5 w-3.5" />
              </span>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', statusDot(check.status))} />
                <p className="text-lg font-semibold tabular-nums leading-none">{check.value ?? '—'}</p>
              </div>
              <p className="truncate text-xs text-muted-foreground">{check.label}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
