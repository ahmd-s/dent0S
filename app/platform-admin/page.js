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
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-zinc-900">Overview</h1>
          <p className="text-[13px] text-zinc-500">
            Clinics, billing health, and platform signals — no patient data.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 border-zinc-200 text-[13px]" onClick={() => loadChrome({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {kpiLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[108px] rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total clinics" value={kpis.total ?? 0} icon={Building2} tone="teal" trend={trends.total} />
          <StatCard label="Active clinics" value={kpis.active ?? 0} icon={CircleCheck} tone="green" />
          <StatCard label="Inactive clinics" value={kpis.inactive ?? 0} icon={UserMinus} tone="slate" />
          <StatCard label="Trial clinics" value={kpis.trial ?? consoleKpis.trial ?? 0} icon={Timer} tone="blue" />
          <StatCard label="Paid clinics" value={kpis.paid ?? consoleKpis.paid ?? 0} icon={CreditCard} tone="teal" />
          <StatCard label="Expired subscriptions" value={kpis.expired ?? consoleKpis.expired ?? 0} icon={Ban} tone="red" />
          <StatCard label="New this month" value={kpis.new_this_month ?? consoleKpis.new_this_month ?? 0} icon={UserPlus} tone="violet" trend={trends.new_this_month} />
          <StatCard
            label="Monthly revenue"
            value={fmtCurrency(consoleKpis.monthly_revenue)}
            hint={consoleKpis.monthly_revenue ? undefined : 'Until billing is complete'}
            icon={IndianRupee}
            tone="green"
            trend={trends.revenue}
          />
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-[13px] font-medium text-zinc-900">System health</h2>
          <p className="text-[12px] text-zinc-400">Live infrastructure checks for the DentOS platform.</p>
        </div>
        <SystemHealthPanel health={health} loading={healthLoading} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_1px_rgba(15,23,42,0.04)]">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Clinic directory</h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">Search, filter, and open a clinic without leaving this console.</p>
        </div>
        <div className="p-5">
          <ClinicsTable onKpis={setTableKpis} />
        </div>
      </section>
    </div>
  )
}
