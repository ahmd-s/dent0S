'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RetryErrorFallback } from '@/components/system/GlobalErrorBoundary'

function MetricCard({ label, value, sub, icon: Icon, alert }) {
  return (
    <Card className={alert ? 'border-amber-300' : ''}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value ?? '—'}</CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  )
}

export function EnterpriseMonitoring() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform-admin/monitoring')
      if (!res.ok) throw new Error('Failed to load monitoring data')
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return <RetryErrorFallback error={error} onRetry={load} title="Enterprise monitoring unavailable" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Enterprise Monitoring</h1>
          <p className="text-muted-foreground">Platform-wide health, queues, latency, and alerts</p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {(data?.alerts || []).length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              System Alerts ({data.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.map((a, i) => (
              <div key={i} className="text-sm flex items-start gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{a.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Health Score" value={`${data?.healthScore ?? 0}%`} icon={Activity} />
        <MetricCard label="API Latency (avg)" value={`${data?.metrics?.avgApiLatencyMs ?? 0}ms`} icon={Timer} />
        <MetricCard label="Errors (24h)" value={data?.metrics?.errorCount ?? 0} icon={TriangleAlert} alert={(data?.metrics?.errorCount ?? 0) > 10} />
        <MetricCard label="Failed Jobs" value={data?.queues?.failed ?? 0} icon={Server} alert={(data?.queues?.failed ?? 0) > 0} />
      </div>

      <Tabs defaultValue="infra">
        <TabsList>
          <TabsTrigger value="infra">Infrastructure</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="ai">AI Usage</TabsTrigger>
          <TabsTrigger value="comm">Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="infra" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Checks</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.checks || []).map(c => (
                <div key={c.name} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div>
                    <span className="font-medium">{c.name}</span>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </div>
                  <Badge variant="outline">{c.status} · {c.value}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Queue Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(data?.queues?.byStatus || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="capitalize">{k.replace('_', ' ')}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Failures</CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.queues?.recentFailures || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent job failures</p>
                ) : (
                  data.queues.recentFailures.map(j => (
                    <div key={j.id} className="py-2 border-b border-border last:border-0 text-sm">
                      <p className="font-medium">{j.type}</p>
                      <p className="text-xs text-red-600">{j.error}</p>
                      <p className="text-xs text-muted-foreground">{j.at && new Date(j.at).toLocaleString('en-IN')}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" /> AI Usage (24h)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-bold">{data?.ai?.totalRequests ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total requests</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.ai?.failedRequests ?? 0}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.ai?.clinicsActive ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active clinics</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comm" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Communication Failures (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.communication?.failedMessages ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Failed outbound messages</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Uptime check: {data?.uptime?.healthy ? 'Healthy' : 'Degraded'} · Last refresh: {data?.at ? new Date(data.at).toLocaleString('en-IN') : '—'}
      </p>
    </div>
  )
}

export default EnterpriseMonitoring
