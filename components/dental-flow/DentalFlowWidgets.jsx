'use client'

import { Clock, Armchair, Stethoscope, Users, AlertTriangle, Activity, Calendar, CheckCircle2, XCircle, UserX, IndianRupee, TrendingUp } from 'lucide-react'
import StatCard from '@/components/ui/stat-card'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export function TodaysQueueStatWidget({ stats }) {
  return <StatCard label="Today's Queue" val={stats?.flow?.waiting_count ?? stats?.today_queue?.length ?? '—'} sub="Patients in flow" icon={Users} color="#0D9488" href="/appointments" />
}

export function ChairStatusWidget({ stats }) {
  return <StatCard label="Chair Utilization" val={stats?.flow?.chair_utilization_pct != null ? `${stats.flow.chair_utilization_pct}%` : '—'} sub="Chairs occupied" icon={Armchair} color="#6366F1" href="/appointments" />
}

export function CurrentTreatmentsWidget({ stats }) {
  return <StatCard label="Current Treatments" val={stats?.flow?.in_treatment ?? '—'} sub="In chair now" icon={Stethoscope} color="#F59E0B" />
}

export function WaitingPatientsWidget({ stats }) {
  return <StatCard label="Waiting Patients" val={stats?.flow?.waiting_count ?? '—'} sub={`Avg ${stats?.flow?.average_wait_minutes ?? 0}m wait`} icon={Clock} color={stats?.flow?.average_wait_minutes > 30 ? '#EF4444' : '#0D9488'} />
}

export function EmergencyQueueWidget({ stats }) {
  return <StatCard label="Emergency Queue" val={stats?.flow?.emergency_queue ?? 0} sub="Priority cases" icon={AlertTriangle} color="#EF4444" />
}

export function DoctorLoadWidget({ stats }) {
  const loads = stats?.flow?.doctor_loads || {}
  const top = Object.values(loads).reduce((s, d) => s + (d.active || 0) + (d.waiting || 0), 0)
  return <StatCard label="Doctor Load" val={top || '—'} sub="Active + waiting" icon={Activity} color="#8B5CF6" />
}

export function AverageWaitWidget({ stats }) {
  return <StatCard label="Average Wait" val={stats?.flow?.average_wait_minutes != null ? `${stats.flow.average_wait_minutes}m` : '—'} sub={`Longest ${stats?.flow?.longest_wait_minutes ?? 0}m`} icon={Clock} color="#0D9488" />
}

export function AppointmentsTodayWidget({ stats }) {
  return <StatCard label="Appointments Today" val={stats?.flow?.appointments_today ?? stats?.today_queue?.length ?? '—'} sub="Scheduled today" icon={Calendar} color="#6366F1" href="/appointments" />
}

export function CompletedTodayWidget({ stats }) {
  return <StatCard label="Completed Today" val={stats?.flow?.completed_today ?? stats?.patients_seen_today ?? '—'} sub="Visits finished" icon={CheckCircle2} color="#22C55E" />
}

export function CancelledTodayWidget({ stats }) {
  return <StatCard label="Cancelled Today" val={stats?.flow?.cancelled_today ?? 0} sub="Cancellations" icon={XCircle} color="#94A3B8" />
}

export function NoShowsWidget({ stats }) {
  return <StatCard label="No Shows" val={stats?.flow?.no_shows_today ?? 0} sub="Today" icon={UserX} color="#94A3B8" />
}

export function RevenueTodayFlowWidget({ stats }) {
  return <StatCard label="Revenue Today" val={stats?.revenue_today != null ? inr(stats.revenue_today) : '—'} sub="Collected" icon={IndianRupee} color="#22C55E" />
}

export function ChairUtilizationWidget({ stats }) {
  return <StatCard label="Chair Utilization" val={stats?.flow?.chair_utilization_pct != null ? `${stats.flow.chair_utilization_pct}%` : '—'} sub="Occupancy rate" icon={Armchair} color="#6366F1" />
}

export function DoctorUtilizationWidget({ stats }) {
  const loads = stats?.flow?.doctor_loads || {}
  const active = Object.values(loads).reduce((s, d) => s + (d.active || 0), 0)
  return <StatCard label="Doctor Utilization" val={active || '—'} sub="In treatment" icon={Stethoscope} color="#8B5CF6" />
}

export function QueueHealthWidget({ stats }) {
  const health = stats?.flow?.queue_health || 'good'
  const colors = { good: '#22C55E', moderate: '#F59E0B', critical: '#EF4444' }
  return <StatCard label="Queue Health" val={health} sub={`Longest wait ${stats?.flow?.longest_wait_minutes ?? 0}m`} icon={TrendingUp} color={colors[health] || '#22C55E'} />
}

export const DENTAL_FLOW_WIDGET_MAP = {
  todays_queue: TodaysQueueStatWidget,
  chair_status: ChairStatusWidget,
  current_treatments: CurrentTreatmentsWidget,
  waiting_patients: WaitingPatientsWidget,
  emergency_queue: EmergencyQueueWidget,
  doctor_load: DoctorLoadWidget,
  average_wait: AverageWaitWidget,
  appointments_today: AppointmentsTodayWidget,
  completed_today: CompletedTodayWidget,
  cancelled_today: CancelledTodayWidget,
  no_shows: NoShowsWidget,
  revenue_today: RevenueTodayFlowWidget,
  chair_utilization: ChairUtilizationWidget,
  doctor_utilization: DoctorUtilizationWidget,
  queue_health: QueueHealthWidget,
}

export const DENTAL_FLOW_STAT_WIDGET_IDS = new Set(Object.keys(DENTAL_FLOW_WIDGET_MAP))
