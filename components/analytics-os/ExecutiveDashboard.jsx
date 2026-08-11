'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, TrendingUp, TrendingDown, IndianRupee, Users, Stethoscope,
  FlaskConical, Package, Activity, BarChart3, ChevronRight, HeartPulse,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import SmartInsightsPanel from './SmartInsightsPanel'
import DoctorPerformancePanel from './DoctorPerformancePanel'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

const HEALTH_COLORS = {
  Excellent: '#22C55E',
  Good: '#0D9488',
  'Needs Attention': '#F59E0B',
  Critical: '#EF4444',
}

function KpiCard({ label, value, sub, trend, href, icon: Icon, color = '#0D9488' }) {
  const inner = (
    <Card className={`p-4 md:p-5 bg-card border-border rounded-xl h-full transition-all ${href ? 'hover:border-[#0D9488]/40 hover:shadow-sm cursor-pointer group' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs md:text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl md:text-3xl font-bold mt-1.5 tabular-nums" style={{ color }}>{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
          {trend != null && (
            <div className={`flex items-center gap-1 text-xs mt-1.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}% vs prev period
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          {href && <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
      </div>
    </Card>
  )
  if (href) return <Link href={href} className="block h-full">{inner}</Link>
  return inner
}

export default function ExecutiveDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/analytics/executive?days=${days}`)
    const d = await r.json()
    setData(d)
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-[#0D9488]" /></div>
  }

  const { revenue, patients, appointments, inventory, lab, health, forecast, insights, doctors } = data || {}
  const healthColor = HEALTH_COLORS[health?.status] || '#0D9488'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Business Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Executive dashboard for clinic owners</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
              className="text-xs"
            >
              {d}d
            </Button>
          ))}
          <Button size="sm" variant="outline" asChild>
            <Link href="/reports">Full Reports</Link>
          </Button>
        </div>
      </div>

      {/* Business Health Hero */}
      <Card className="p-5 md:p-6 border-2" style={{ borderColor: healthColor + '40' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: healthColor + '15' }}>
              <HeartPulse className="w-8 h-8" style={{ color: healthColor }} />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Business Health Score</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums" style={{ color: healthColor }}>{health?.score ?? '—'}</span>
                <span className="text-lg text-muted-foreground">/ 100</span>
              </div>
              <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ backgroundColor: healthColor + '15', color: healthColor }}>
                {health?.status}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full sm:w-auto">
            {(health?.breakdown || []).slice(0, 5).map(f => (
              <div key={f.key} className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold tabular-nums">{Math.round(f.value)}</div>
                <div className="text-[9px] text-muted-foreground capitalize">{f.key.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        <KpiCard label="Revenue" value={inr(revenue?.total_revenue)} sub={`${revenue?.paid_count || 0} invoices paid`} trend={revenue?.growth_pct} href="/reports?section=revenue" icon={IndianRupee} color="#6366F1" />
        <KpiCard label="Collections" value={inr(revenue?.collected)} sub={`${revenue?.collection_efficiency_pct}% efficiency`} href="/billing" icon={IndianRupee} color="#0D9488" />
        <KpiCard label="Pending Collections" value={inr(revenue?.pending_collections)} sub="Outstanding" href="/billing?status=pending" icon={IndianRupee} color="#F59E0B" />
        <KpiCard label="Patients" value={patients?.total_patients ?? '—'} sub={`${patients?.new_patients || 0} new · ${patients?.retention_pct || 0}% retention`} href="/patients" icon={Users} color="#8B5CF6" />
        <KpiCard label="Active Treatments" value={appointments?.flow?.in_treatment ?? appointments?.total_appointments ?? '—'} sub={`${appointments?.completion_rate_pct || 0}% completion`} href="/appointments" icon={Stethoscope} color="#0D9488" />
        <KpiCard label="Lab Performance" value={lab?.lab_efficiency_score != null ? `${lab.lab_efficiency_score}%` : '—'} sub={`${lab?.open_cases || 0} open · ${lab?.delayed_pct || 0}% delayed`} href="/lab-cases" icon={FlaskConical} color="#6366F1" />
        <KpiCard label="Inventory Health" value={inventory?.inventory_health_pct != null ? `${inventory.inventory_health_pct}%` : '—'} sub={`Value ${inr(inventory?.total_value)}`} href="/inventory" icon={Package} color="#F59E0B" />
        <KpiCard label="Forecast" value={inr(forecast?.next_month_revenue)} sub="Next month revenue (est.)" href="/reports?section=forecast" icon={BarChart3} color="#8B5CF6" />
      </div>

      <SmartInsightsPanel insights={insights || []} />

      <DoctorPerformancePanel doctors={doctors?.doctors || []} leaderboard={doctors?.leaderboard || []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 md:p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0D9488]" /> Appointment Intelligence
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">No-show rate</span><div className="font-bold">{appointments?.no_show_rate_pct}%</div></div>
            <div><span className="text-muted-foreground">Cancellation</span><div className="font-bold">{appointments?.cancellation_rate_pct}%</div></div>
            <div><span className="text-muted-foreground">Peak hour</span><div className="font-bold">{appointments?.peak_hour ? `${appointments.peak_hour.hour}:00` : '—'}</div></div>
            <div><span className="text-muted-foreground">Busiest day</span><div className="font-bold">{appointments?.peak_weekday?.day || '—'}</div></div>
            <div><span className="text-muted-foreground">Avg wait</span><div className="font-bold">{appointments?.average_wait_minutes ?? '—'} min</div></div>
            <div><span className="text-muted-foreground">Chair util.</span><div className="font-bold">{appointments?.chair_utilization_pct ?? '—'}%</div></div>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <h3 className="text-sm font-semibold mb-3">Top Treatments by Revenue</h3>
          <div className="space-y-2">
            {(data?.treatments?.highest_revenue_treatments || []).slice(0, 5).map(t => (
              <div key={t.name} className="flex justify-between text-sm">
                <span className="truncate mr-2">{t.name}</span>
                <span className="font-medium tabular-nums">{inr(t.revenue)}</span>
              </div>
            ))}
            {!data?.treatments?.highest_revenue_treatments?.length && (
              <p className="text-sm text-muted-foreground">No treatment data yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
