'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Bot,
  Database,
  HardDrive,
  Loader2,
  MessageSquare,
  RefreshCw,
  Server,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RetryErrorFallback } from '@/components/system/GlobalErrorBoundary'

function StatusBadge({ status }) {
  const map = {
    healthy: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  }
  return (
    <Badge variant="outline" className={map[status] || map.warning}>
      {status}
    </Badge>
  )
}

function CheckRow({ check }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{check.name}</p>
        <p className="text-xs text-muted-foreground">{check.label}</p>
      </div>
      <div className="flex items-center gap-2">
        {check.value != null && <span className="text-xs text-muted-foreground">{check.value}</span>}
        <StatusBadge status={check.status} />
      </div>
    </div>
  )
}

export function SystemHealthDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/system/health')
      if (!res.ok) throw new Error('Failed to load system health')
      setData(await res.json())
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <RetryErrorFallback
        error={error}
        onRetry={load}
        title="System health unavailable"
        suggestion="Check your connection and try again."
      />
    )
  }

  const score = data?.healthScore ?? 0
  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Health</h2>
          <p className="text-sm text-muted-foreground">Database, queues, integrations, and performance</p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Health Score</CardDescription>
            <CardTitle className={`text-3xl ${scoreColor}`}>{score}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Database className="h-3.5 w-3.5" /> Database</CardDescription>
            <CardTitle className="text-lg">{data?.database?.latencyMs ?? '—'}ms</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> API Latency</CardDescription>
            <CardTitle className="text-lg">{data?.metrics?.avgApiLatencyMs ?? 0}ms avg</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><TriangleAlert className="h-3.5 w-3.5" /> Errors (24h)</CardDescription>
            <CardTitle className="text-lg">{data?.metrics?.errorCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Infrastructure</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.checks || []).slice(0, 8).map(c => <CheckRow key={c.name} check={c} />)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Queues & Engines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Communication</span>
              <StatusBadge status={data?.engines?.communication ?? 'healthy'} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> AI Engine</span>
              <StatusBadge status={data?.engines?.ai ?? 'healthy'} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Activity</span>
              <StatusBadge status={data?.engines?.activity ?? 'healthy'} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Background Jobs</span>
              <span className="text-xs text-muted-foreground">
                {data?.queues?.pending ?? 0} pending · {data?.queues?.failed ?? 0} failed
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">Last updated: {data?.at ? new Date(data.at).toLocaleString('en-IN') : '—'}</p>
    </div>
  )
}

export default SystemHealthDashboard
