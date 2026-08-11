'use client'

import Link from 'next/link'
import { FlaskConical, Clock, AlertTriangle, Truck, Wrench, Activity, CheckCircle2, Package } from 'lucide-react'
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

export function LabQueueWidget({ stats }) {
  return <StatCard label="Lab Queue" val={stats?.lab?.open_cases ?? '—'} sub="Open cases" icon={FlaskConical} color="#6366F1" href="/lab-cases" />
}

export function CasesDueTodayWidget({ stats }) {
  return <StatCard label="Due Today" val={stats?.lab?.due_today ?? '—'} sub="Expected today" icon={Clock} color="#F59E0B" href="/lab-cases" />
}

export function DelayedCasesWidget({ stats }) {
  return <StatCard label="Delayed Cases" val={stats?.lab?.delayed_cases ?? '—'} sub={`${stats?.lab?.delay_percentage ?? 0}% delay rate`} icon={AlertTriangle} color="#EF4444" href="/lab-cases?status=overdue" />
}

export function AwaitingDispatchWidget({ stats }) {
  return <StatCard label="Awaiting Dispatch" val={stats?.lab?.awaiting_dispatch ?? '—'} sub="Ready for pickup" icon={Truck} color="#8B5CF6" href="/lab-cases?status=ready" />
}

export function AwaitingInstallationWidget({ stats }) {
  return <StatCard label="Awaiting Installation" val={stats?.lab?.awaiting_installation ?? '—'} sub="Delivered, not installed" icon={Wrench} color="#0D9488" href="/lab-cases?status=delivered" />
}

export function AverageTurnaroundWidget({ stats }) {
  return <StatCard label="Avg Turnaround" val={stats?.lab?.average_turnaround_days != null ? `${stats.lab.average_turnaround_days}d` : '—'} sub="Sent to delivered" icon={Activity} color="#6366F1" />
}

export function OpenCasesWidget({ stats }) {
  return <StatCard label="Open Cases" val={stats?.lab?.open_cases ?? '—'} sub="In progress" icon={Package} color="#6366F1" href="/lab-cases" />
}

export function CompletedThisWeekWidget({ stats }) {
  return <StatCard label="Completed This Week" val={stats?.lab?.completed_this_week ?? '—'} sub="Cases finished" icon={CheckCircle2} color="#22C55E" />
}

export function VendorPerformanceWidget({ stats }) {
  const vendors = stats?.lab?.vendor_stats || {}
  const count = Object.keys(vendors).length
  return <StatCard label="Active Vendors" val={count || '—'} sub="With open cases" icon={FlaskConical} color="#8B5CF6" href="/vendors" />
}

export function RecentLabActivityWidget() {
  return null // Rendered via RecentActivityWidget with module filter
}

export const LAB_FLOW_WIDGET_MAP = {
  lab_queue: LabQueueWidget,
  cases_due_today: CasesDueTodayWidget,
  delayed_cases: DelayedCasesWidget,
  vendor_performance: VendorPerformanceWidget,
  awaiting_dispatch: AwaitingDispatchWidget,
  awaiting_installation: AwaitingInstallationWidget,
  average_turnaround: AverageTurnaroundWidget,
  open_cases: OpenCasesWidget,
  completed_this_week: CompletedThisWeekWidget,
}

export const LAB_FLOW_STAT_WIDGET_IDS = new Set(Object.keys(LAB_FLOW_WIDGET_MAP))
