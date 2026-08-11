'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function SystemHealthWidget() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/system/health')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="p-4 flex items-center justify-center min-h-[100px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    )
  }

  const score = data?.healthScore ?? 0
  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#0D9488]" />
          <span className="font-medium text-sm">System Health</span>
        </div>
        <span className={`text-lg font-bold ${scoreColor}`}>{score}%</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
        <span>DB: {data?.database?.latencyMs ?? '—'}ms</span>
        <span>Errors: {data?.metrics?.errorCount ?? 0}</span>
        <span>Jobs: {data?.queues?.pending ?? 0} pending</span>
        <span>API: {data?.metrics?.avgApiLatencyMs ?? 0}ms</span>
      </div>
      <Button asChild size="sm" variant="outline" className="w-full h-8 text-xs">
        <Link href="/settings/system">View details</Link>
      </Button>
    </Card>
  )
}

export const SYSTEM_FLOW_WIDGET_MAP = {
  system_health: SystemHealthWidget,
}

export const SYSTEM_FLOW_STAT_WIDGET_IDS = ['system_health']
