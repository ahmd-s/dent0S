'use client'

import { useCallback, useEffect, useState } from 'react'
import { HeartPulse, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SystemHealthPanel } from '@/components/platform-admin/SystemHealthPanel'
import { fmtDateTime } from '@/components/platform-admin/format'

export default function SystemHealthPage() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch('/api/platform-admin/system-health')
      if (!r.ok) throw new Error()
      setHealth(await r.json())
    } catch {
      toast.error('Failed to load system health')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HeartPulse className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">System health</h1>
            <p className="text-sm text-muted-foreground">
              Super Admin only — live signals for the platform, not any one clinic.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <SystemHealthPanel health={health} loading={loading} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent operational alerts</CardTitle>
          <CardDescription>
            {health?.at ? `Snapshot ${fmtDateTime(health.at)}` : 'Trial expiry, grace, payment, and emergency lock events from the last 7 days.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(health?.recent_errors || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent alerts.</p>
          ) : (
            <ul className="divide-y divide-border">
              {health.recent_errors.map(err => (
                <li key={err.id || `${err.action}-${err.at}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{(err.action || '').replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{err.target_clinic_name || err.target_clinic_id || 'Platform'}</p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(err.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
