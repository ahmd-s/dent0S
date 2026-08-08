'use client'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionHeading } from '@/components/platform-admin/Placeholder'
import { toast } from 'sonner'

const STATUS_ICONS = {
  healthy: CheckCircle2,
  warning: AlertTriangle,
  failed: XCircle,
}

const STATUS_COLORS = {
  healthy: {
    icon: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10',
    dot: 'bg-green-500',
    border: 'border-green-500/20',
  },
  warning: {
    icon: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    dot: 'bg-amber-500',
    border: 'border-amber-500/20',
  },
  failed: {
    icon: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    dot: 'bg-red-500',
    border: 'border-red-500/20',
  },
}

function CheckCard({ check }) {
  const s = STATUS_COLORS[check.status] || STATUS_COLORS.warning
  const Icon = STATUS_ICONS[check.status] || AlertTriangle

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${s.border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}>
            <Icon className={`h-4 w-4 ${s.icon}`} />
          </span>
          <span className="text-sm font-medium text-foreground">{check.name}</span>
        </div>
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      </div>
      <div>
        {check.value && (
          <p className="text-lg font-semibold text-foreground">{check.value}</p>
        )}
        <p className="text-xs text-muted-foreground">{check.label}</p>
      </div>
    </div>
  )
}

export default function DiagnosticsSection({ clinic }) {
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [at, setAt] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/diagnostics`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setChecks(d.checks || [])
      setAt(d.at)
    } catch {
      toast.error('Failed to load diagnostics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [clinic.id])

  useEffect(() => { load() }, [load])

  const healthy = checks.filter(c => c.status === 'healthy').length
  const warned = checks.filter(c => c.status === 'warning').length
  const failed = checks.filter(c => c.status === 'failed').length

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeading
          title="Live Diagnostics"
          description={
            at
              ? `Last checked: ${new Date(at).toLocaleTimeString('en-IN')}`
              : 'Health status for this clinic.'
          }
        />
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />{healthy} healthy</span>
            {warned > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{warned} warning</span>}
            {failed > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />{failed} failed</span>}
          </div>
          <Button variant="outline" size="sm" onClick={() => load({ silent: true })} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {checks.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No diagnostics data available</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {checks.map((c, i) => <CheckCard key={i} check={c} />)}
        </div>
      )}
    </div>
  )
}
