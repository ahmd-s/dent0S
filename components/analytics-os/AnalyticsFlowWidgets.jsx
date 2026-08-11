'use client'

import Link from 'next/link'
import {
  TrendingUp, Users, Calendar, Stethoscope, IndianRupee, HeartPulse,
  Package, FlaskConical, BarChart3, Clock, Target,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

function StatCard({ label, val, sub, icon: Icon, color, href }) {
  const inner = (
    <Card className={`p-3.5 bg-card border-border rounded-xl h-full ${href ? 'hover:border-[#0D9488]/40 cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color }}>{val}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
    </Card>
  )
  if (href) return <Link href={href} className="block h-full">{inner}</Link>
  return inner
}

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export function RevenueTrendWidget({ stats }) {
  const growth = stats?.analytics?.revenue?.growth_pct ?? stats?.revenue?.growth_pct
  return (
    <StatCard
      label="Revenue Trend"
      val={stats?.analytics?.revenue?.total_revenue != null ? inr(stats.analytics.revenue.total_revenue) : inr(stats?.revenue_today)}
      sub={growth != null ? `${growth >= 0 ? '+' : ''}${growth}% growth` : 'Period revenue'}
      icon={TrendingUp}
      color="#6366F1"
      href="/business"
    />
  )
}

export function PatientGrowthWidget({ stats }) {
  const p = stats?.analytics?.patients
  return (
    <StatCard label="Patient Growth" val={p?.new_patients ?? '—'} sub={`${p?.retention_pct ?? 0}% retention`} icon={Users} color="#8B5CF6" href="/business" />
  )
}

export function AppointmentTrendWidget({ stats }) {
  const a = stats?.analytics?.appointments
  return (
    <StatCard label="Appointment Trend" val={a?.total_appointments ?? '—'} sub={`${a?.completion_rate_pct ?? 0}% completed`} icon={Calendar} color="#0D9488" href="/business" />
  )
}

export function TodaysCollectionsWidget({ stats }) {
  return (
    <StatCard label="Today's Collections" val={inr(stats?.revenue_today)} sub="Paid invoices today" icon={IndianRupee} color="#0D9488" href="/billing" />
  )
}

export function DoctorLeaderboardWidget({ stats }) {
  const top = stats?.analytics?.doctors?.leaderboard?.[0]
  return (
    <StatCard label="Top Doctor" val={top?.name?.split(' ')[0] || '—'} sub={top ? inr(top.revenue) : 'By revenue'} icon={Stethoscope} color="#6366F1" href="/business" />
  )
}

export function BusinessHealthWidget({ stats }) {
  const h = stats?.analytics?.health
  const color = h?.score >= 85 ? '#22C55E' : h?.score >= 70 ? '#0D9488' : h?.score >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <StatCard label="Business Health" val={h?.score != null ? `${h.score}/100` : '—'} sub={h?.status || 'Score'} icon={HeartPulse} color={color} href="/business" />
  )
}

export function BiInventoryHealthWidget({ stats }) {
  const inv = stats?.analytics?.inventory ?? stats?.inventory
  return (
    <StatCard label="Inventory Health" val={inv?.inventory_health_pct != null ? `${inv.inventory_health_pct}%` : '—'} sub="Stock health" icon={Package} color="#F59E0B" href="/inventory" />
  )
}

export function LabHealthWidget({ stats }) {
  const lab = stats?.analytics?.lab ?? stats?.lab
  return (
    <StatCard label="Lab Health" val={lab?.lab_efficiency_score != null ? `${lab.lab_efficiency_score}%` : '—'} sub={`${lab?.open_cases ?? lab?.open_cases ?? 0} open`} icon={FlaskConical} color="#6366F1" href="/lab-cases" />
  )
}

export function ForecastWidget({ stats }) {
  const f = stats?.analytics?.forecast
  return (
    <StatCard label="Forecast" val={f?.next_month_revenue != null ? inr(f.next_month_revenue) : '—'} sub="Next month est." icon={BarChart3} color="#8B5CF6" href="/business" />
  )
}

export function TopTreatmentsWidget({ stats }) {
  const t = stats?.analytics?.treatments?.top_treatments?.[0]
  return (
    <StatCard label="Top Treatment" val={t?.count ?? '—'} sub={t?.name?.slice(0, 24) || 'Most frequent'} icon={Target} color="#0D9488" href="/reports?section=treatments" />
  )
}

export function CollectionDueWidget({ stats }) {
  const pending = stats?.analytics?.revenue?.pending_collections ?? stats?.pending_today
  return (
    <StatCard label="Collection Due" val={pending != null ? inr(pending) : '—'} sub="Outstanding" icon={Clock} color="#F59E0B" href="/billing?status=pending" />
  )
}

export function RetentionWidget({ stats }) {
  const r = stats?.analytics?.patients?.retention_pct
  return (
    <StatCard label="Retention" val={r != null ? `${r}%` : '—'} sub="Returning patients" icon={Users} color="#8B5CF6" href="/business" />
  )
}

export const ANALYTICS_FLOW_WIDGET_MAP = {
  revenue_trend: RevenueTrendWidget,
  patient_growth: PatientGrowthWidget,
  appointment_trend: AppointmentTrendWidget,
  todays_collections: TodaysCollectionsWidget,
  doctor_leaderboard: DoctorLeaderboardWidget,
  business_health: BusinessHealthWidget,
  bi_inventory_health: BiInventoryHealthWidget,
  lab_health: LabHealthWidget,
  forecast: ForecastWidget,
  top_treatments: TopTreatmentsWidget,
  collection_due: CollectionDueWidget,
  retention: RetentionWidget,
}

export const ANALYTICS_FLOW_STAT_WIDGET_IDS = new Set(Object.keys(ANALYTICS_FLOW_WIDGET_MAP))
