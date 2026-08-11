'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, TriangleAlert, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { RetryErrorFallback } from '@/components/system/GlobalErrorBoundary'

const STATUS_ICON = {
  healthy: CheckCircle2,
  warning: TriangleAlert,
  failed: XCircle,
}

function CheckItem({ check }) {
  const Icon = STATUS_ICON[check.status] || TriangleAlert
  const color = check.status === 'healthy' ? 'text-green-600' : check.status === 'warning' ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-0">
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{check.name}</p>
        <p className="text-xs text-muted-foreground">{check.label}</p>
        {check.suggestion && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{check.suggestion}</p>
        )}
      </div>
      {check.value != null && (
        <span className="text-xs text-muted-foreground shrink-0">{String(check.value)}</span>
      )}
    </div>
  )
}

export function DiagnosticsPanel({ scope = 'clinic', apiPath = '/api/system/diagnostics' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiPath)
      if (!res.ok) throw new Error('Diagnostics failed')
      setData(await res.json())
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [apiPath])

  useEffect(() => { run() }, [run])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Running diagnostics…</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <RetryErrorFallback error={error} onRetry={run} title="Diagnostics unavailable" />
  }

  const score = data?.healthScore ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Production Diagnostics</h2>
          <p className="text-sm text-muted-foreground">
            Automatic checks for indexes, orphans, config, and queues
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={run}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Re-run
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Health Score</CardDescription>
          <div className="flex items-end gap-3">
            <CardTitle className="text-3xl">{score}%</CardTitle>
            <Progress value={score} className="flex-1 mb-2" />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnostic Results</CardTitle>
          <CardDescription>{data?.checks?.length ?? 0} checks · {scope} scope</CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.checks || []).map(c => (
            <CheckItem key={`${c.name}-${c.label}`} check={c} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default DiagnosticsPanel
