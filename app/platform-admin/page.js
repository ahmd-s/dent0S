'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Ban,
  Building2,
  CircleCheck,
  CreditCard,
  IndianRupee,
  RefreshCw,
  Timer,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ClinicsTable } from '@/components/platform-admin/ClinicsTable'
import { StatCard } from '@/components/platform-admin/StatCard'
import { SystemHealthPanel } from '@/components/platform-admin/SystemHealthPanel'
import { toast } from 'sonner'

const fmtCurrency = v => `₹${(v || 0).toLocaleString('en-IN')}`

export default function PlatformAdminPage() {
  const [refreshing, setRefreshing] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [health, setHealth] = useState(null)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(true)
  const [tableKpis, setTableKpis] = useState(null)

  const loadChrome = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else {
      setKpiLoading(true)
      setHealthLoading(true)
    }
    try {
      const [metricsRes, healthRes] = await Promise.all([
        fetch('/api/platform-admin/metrics'),
        fetch('/api/platform-admin/system-health'),
      ])
      if (metricsRes.ok) {
        const data = await metricsRes.json()
        setMetrics(data)
        if (data?.degraded) toast.error('KPIs loaded with incomplete data')
      } else {
        toast.error('Failed to load KPIs')
      }
      if (healthRes.ok) setHealth(await healthRes.json())
    } catch {
      toast.error('Network error')
    } finally {
      setKpiLoading(false)
      setHealthLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadChrome() }, [loadChrome])

  const consoleKpis = metrics?.console || {}
  const kpis = tableKpis || consoleKpis
  const trends = consoleKpis.trends || {}

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Platform console</h1>
          <p className="text-sm text-muted-foreground">
            Monitor every clinic, follow up on quiet leads, and keep DentOS healthy.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadChrome({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {kpiLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[102px] rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Total Clinics" value={kpis.total ?? 0} icon={Building2} tone="teal" trend={trends.total} />
          <StatCard label="Active Clinics" value={kpis.active ?? 0} icon={CircleCheck} tone="green" />
          <StatCard label="Inactive Clinics" value={kpis.inactive ?? 0} icon={UserMinus} tone="slate" />
          <StatCard label="Trial Clinics" value={kpis.trial ?? consoleKpis.trial ?? 0} icon={Timer} tone="blue" />
          <StatCard label="Paid Clinics" value={kpis.paid ?? consoleKpis.paid ?? 0} icon={CreditCard} tone="teal" />
          <StatCard label="Expired Subscriptions" value={kpis.expired ?? consoleKpis.expired ?? 0} icon={Ban} tone="red" />
          <StatCard label="New This Month" value={kpis.new_this_month ?? consoleKpis.new_this_month ?? 0} icon={UserPlus} tone="violet" trend={trends.new_this_month} />
          <StatCard
            label="Monthly Revenue"
            value={fmtCurrency(consoleKpis.monthly_revenue)}
            hint={consoleKpis.monthly_revenue ? undefined : 'Placeholder until billing is complete'}
            icon={IndianRupee}
            tone="green"
            trend={trends.revenue}
          />
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">System health</p>
        <SystemHealthPanel health={health} loading={healthLoading} />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Clinic directory</CardTitle>
          <CardDescription>Search, filter, and open a clinic without leaving this console.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClinicsTable onKpis={setTableKpis} />
        </CardContent>
      </Card>
    </div>
  )
}
