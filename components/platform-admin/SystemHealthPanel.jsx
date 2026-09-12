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
          <Card key={check.id || check.name} className="border-zinc-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-[10px] font-medium leading-snug text-zinc-500">
                {check.name}
              </CardTitle>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', statusSurface(check.status))}>
                <Icon className="h-3 w-3" />
              </span>
            </CardHeader>
            <CardContent className="space-y-1 p-3 pt-1">
              <div className="flex items-center gap-2">
                <span className={cn('h-1.5 w-1.5 rounded-full', statusDot(check.status))} />
                <p className="text-[15px] font-semibold tabular-nums leading-none">{check.value ?? '—'}</p>
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">{check.label}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
