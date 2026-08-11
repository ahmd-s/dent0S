'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  IndianRupee,
  AlertCircle,
  UserCheck,
  MoreVertical,
  MessageCircle,
  Plus,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

const fmtDate = d => {
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}
const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

const statusBadge = s => {
  const map = {
    scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    confirmed: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300',
    checked_in: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
    waiting: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    called: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300',
    in_treatment: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
    arrived: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
    in_progress: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
    completed: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300',
    cancelled: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    no_show: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }
  const label = { checked_in: 'Checked In', in_treatment: 'In Treatment', arrived: 'Checked In', in_progress: 'In Treatment' }[s] || s?.replace('_', ' ')
  return (
    <span className={`text-xs px-2 py-1 rounded-full capitalize whitespace-nowrap ${map[s] || 'bg-slate-100 dark:bg-slate-800'}`}>
      {label}
    </span>
  )
}

function StatCard({ label, val, sub, icon: Icon, color, href, compact = false }) {
  const inner = (
    <Card className={`bg-card border-border h-full ${compact ? 'p-2.5 sm:p-3 rounded-lg' : 'p-3.5 sm:p-4 md:p-5 rounded-xl'} ${href ? 'hover:border-[#0D9488]/40 transition-colors cursor-pointer active:scale-[0.98]' : ''}`}>
      <div className={`flex ${compact ? 'items-center' : 'items-start'} justify-between gap-2`}>
        <div className="flex-1 min-w-0">
          <div className={`text-muted-foreground leading-snug ${compact ? 'text-[11px] line-clamp-1' : 'text-xs md:text-sm line-clamp-2'}`}>{label}</div>
          <div className={`font-bold leading-none tabular-nums ${compact ? 'text-lg sm:text-xl mt-0.5' : 'text-2xl md:text-3xl mt-1.5 md:mt-2'}`} style={{ color }}>{val}</div>
          {!compact && sub && <div className="text-[11px] sm:text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-snug">{sub}</div>}
        </div>
        <div className={`rounded-md flex items-center justify-center flex-shrink-0 ${compact ? 'w-7 h-7' : 'w-9 h-9 md:w-10 md:h-10 rounded-lg'}`} style={{ backgroundColor: color + '15' }}>
          <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4 md:w-5 md:h-5'} style={{ color }} />
        </div>
      </div>
    </Card>
  )
  if (href) return <Link href={href} className="min-w-0 block h-full">{inner}</Link>
  return <div className="min-w-0 h-full">{inner}</div>
}

export function TodaysPatientsWidget({ stats, compact }) {
  return (
    <StatCard
      compact={compact}
      label="Patients Seen Today"
      val={stats?.patients_seen_today ?? '—'}
      sub={stats ? `vs ${stats.patients_seen_yesterday ?? 0} yesterday` : ''}
      icon={UserCheck}
      color="#0D9488"
    />
  )
}

export function RevenueWidget({ stats, compact }) {
  return (
    <StatCard
      compact={compact}
      label="Revenue Collected"
      val={stats ? inr(stats.revenue_today) : '—'}
      sub="Across paid invoices today"
      icon={IndianRupee}
      color="#22C55E"
    />
  )
}

export function PendingBillsWidget({ stats, compact }) {
  return (
    <StatCard
      compact={compact}
      label="Pending Payments"
      val={stats ? inr(stats.pending_today) : '—'}
      sub="Pending & partial today"
      icon={AlertCircle}
      color={stats?.pending_today > 0 ? '#F59E0B' : '#94A3B8'}
    />
  )
}

export function FollowupsStatWidget({ stats }) {
  return (
    <StatCard
      label="Follow-ups Due"
      val={stats?.followups_due_count ?? '—'}
      sub="Patients due for return visit"
      icon={Calendar}
      color={stats?.followups_due_count > 0 ? '#EF4444' : '#94A3B8'}
    />
  )
}

const LAB_CASE_SECONDARY_CARDS = stats => [
  { label: 'Cases In Production', val: stats?.in_production_lab_cases ?? '—', sub: 'Being made at the lab', icon: FlaskConical, color: '#0D9488', href: '/lab-cases?status=lab_received,in_production,in_progress' },
  { label: 'Cases Ready', val: stats?.ready_lab_cases ?? '—', sub: 'Ready / awaiting delivery', icon: FlaskConical, color: '#22C55E', href: '/lab-cases?status=ready' },
  { label: 'Overdue Cases', val: stats?.overdue_lab_cases ?? '—', sub: 'Past expected delivery', icon: AlertTriangle, color: stats?.overdue_lab_cases > 0 ? '#EF4444' : '#94A3B8', href: '/lab-cases?status=overdue' },
]

export function AwaitingLabAcceptanceWidget({ stats, compact }) {
  return (
    <StatCard
      compact={compact}
      label="Awaiting Lab Acceptance"
      val={stats?.awaiting_lab_acceptance ?? '—'}
      sub="Sent, not yet received by lab"
      icon={FlaskConical}
      color="#6366F1"
      href="/lab-cases?status=sent"
    />
  )
}

export function LabCasesSecondaryWidgets({ stats }) {
  return (
    <>
      {LAB_CASE_SECONDARY_CARDS(stats).map(c => (
        <StatCard key={c.label} {...c} />
      ))}
    </>
  )
}

/** @deprecated Use AwaitingLabAcceptanceWidget + LabCasesSecondaryWidgets */
export function LabCasesWidget({ stats }) {
  return (
    <>
      <AwaitingLabAcceptanceWidget stats={stats} />
      <LabCasesSecondaryWidgets stats={stats} />
    </>
  )
}

export function QueueWidget({
  stats,
  showQueue,
  showQueueToggle,
  toggleQueue,
  canStartVisit,
  setStatus,
  startVisit,
  cont,
  onBook,
}) {
  const router = useRouter()
  if (showQueueToggle && !showQueue) return null

  return (
    <Card className="lg:col-span-3 p-4 md:p-6 bg-card border-border rounded-lg">
      <div className="flex items-center justify-between mb-2 md:mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-foreground text-base md:text-lg">Today&apos;s Appointment Queue</h3>
        <div className="flex items-center gap-3">
          {showQueueToggle && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Switch checked={showQueue} onCheckedChange={toggleQueue} />
              Show queue
            </label>
          )}
          <span className="text-xs text-muted-foreground">{fmtDate(new Date())}</span>
        </div>
      </div>
      {!stats && <div className="text-sm text-muted-foreground py-6">Loading…</div>}
      {stats && stats.today_queue.length === 0 && (
        <div className="text-center py-8 md:py-12">
          <Calendar className="w-8 h-8 md:w-10 md:h-10 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mt-2">No appointments scheduled for today</p>
          <Button onClick={onBook} className="mt-3 bg-[#0D9488] hover:bg-[#0B7E73] h-11 px-4">
            <Plus className="w-4 h-4 mr-1" />Add Appointment
          </Button>
        </div>
      )}
      {stats && stats.today_queue.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm mt-3">
              <thead className="text-xs uppercase text-muted-foreground tracking-wider border-b border-border">
                <tr>
                  <th className="text-left py-2 font-medium">Time</th>
                  <th className="text-left font-medium">Patient</th>
                  <th className="text-left font-medium">Type</th>
                  <th className="text-left font-medium">Doctor</th>
                  <th className="text-left font-medium">Status</th>
                  <th className="text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.today_queue.map(a => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium text-[#0D9488] whitespace-nowrap">{a.appointment_time}</td>
                    <td className="py-3">
                      <Link href={`/patients/${a.patient_id}`} className="font-medium hover:text-[#0D9488]">{a.patient_name || a.patient_name_temp}</Link>
                    </td>
                    <td className="py-3 text-muted-foreground capitalize">{a.appointment_type?.replace('_', ' ')}</td>
                    <td className="py-3 text-muted-foreground">{a.doctor_name || '—'}</td>
                    <td className="py-3">{statusBadge(a.status)}</td>
                    <td className="py-3">
                      <div className="flex justify-end items-center gap-1">
                        {['scheduled', 'confirmed'].includes(a.status) && (
                          <Button size="sm" onClick={() => setStatus(a.id, 'checked_in')} className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
                            {!canStartVisit ? 'Check In' : 'Mark Arrived'}
                          </Button>
                        )}
                        {canStartVisit && ['called', 'checked_in', 'arrived'].includes(a.status) && (
                          <Button size="sm" onClick={() => startVisit(a)} className="h-8 text-xs bg-[#0D9488] hover:bg-[#0B7E73]">Start Visit</Button>
                        )}
                        {!canStartVisit && ['checked_in', 'waiting', 'arrived'].includes(a.status) && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap pr-1">Waiting for doctor</span>
                        )}
                        {canStartVisit && ['in_progress', 'in_treatment'].includes(a.status) && (
                          <Button size="sm" onClick={() => cont(a)} className="h-8 text-xs bg-orange-500 hover:bg-orange-600">Continue</Button>
                        )}
                        {canStartVisit && a.status === 'completed' && a.visit_id && (
                          <Button size="sm" variant="outline" onClick={() => router.push(`/visits/${a.visit_id}`)} className="h-8 text-xs">View</Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 hover:bg-muted rounded flex items-center justify-center"><MoreVertical className="w-3.5 h-3.5" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setStatus(a.id, 'cancelled')}>Cancel Appointment</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatus(a.id, 'no_show')}>Mark No Show</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3 mt-3">
            {stats.today_queue.map(a => (
              <div key={a.id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-primary text-sm">{a.appointment_time}</span>
                      {statusBadge(a.status)}
                    </div>
                    <Link href={`/patients/${a.patient_id}`} className="font-medium text-sm hover:text-primary block truncate">{a.patient_name || a.patient_name_temp}</Link>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{a.appointment_type?.replace('_', ' ')} · {a.doctor_name || '—'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {['scheduled', 'confirmed'].includes(a.status) && (
                    <Button size="sm" onClick={() => setStatus(a.id, 'checked_in')} className="h-9 text-xs flex-1 min-w-[100px] bg-blue-600 hover:bg-blue-700">
                      {!canStartVisit ? 'Check In' : 'Mark Arrived'}
                    </Button>
                  )}
                  {canStartVisit && ['called', 'checked_in', 'arrived'].includes(a.status) && (
                    <Button size="sm" onClick={() => startVisit(a)} className="h-9 text-xs flex-1 min-w-[100px] bg-[#0D9488] hover:bg-[#0B7E73]">Start Visit</Button>
                  )}
                  {canStartVisit && ['in_progress', 'in_treatment'].includes(a.status) && (
                    <Button size="sm" onClick={() => cont(a)} className="h-9 text-xs flex-1 min-w-[100px] bg-orange-500 hover:bg-orange-600">Continue</Button>
                  )}
                  {canStartVisit && a.status === 'completed' && a.visit_id && (
                    <Button size="sm" variant="outline" onClick={() => router.push(`/visits/${a.visit_id}`)} className="h-9 text-xs flex-1">View</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

export function FollowupsPanelWidget({ stats }) {
  return (
    <Card className="lg:col-span-2 p-4 md:p-6 bg-card border-border rounded-lg">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <h3 className="font-semibold text-foreground text-base md:text-lg">Pending Follow-ups</h3>
        {stats?.followups?.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Due Now</span>
        )}
      </div>
      {stats?.followups?.length === 0 && (
        <div className="text-sm text-muted-foreground py-4 md:py-6 text-center">No follow-ups pending</div>
      )}
      {stats?.followups?.map(p => {
        const overdue = new Date(p.next_followup_date) < new Date()
        return (
          <div key={p.id} className="py-3 border-b border-border last:border-0">
            <div className="flex items-center justify-between">
              <Link href={`/patients/${p.id}`} className="font-medium text-sm hover:text-[#0D9488] truncate flex-1">{p.name}</Link>
              <span className={`text-xs ml-2 flex-shrink-0 ${overdue ? 'text-[#EF4444]' : 'text-success'}`}>{fmtDate(p.next_followup_date)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{p.last_visit_reason || '—'}</div>
          </div>
        )
      })}
      {stats?.followups?.length > 0 && (
        <Link href="/patients" className="text-xs text-[#0D9488] hover:underline mt-3 inline-block">View all follow-ups →</Link>
      )}
    </Card>
  )
}

import {
  RecentPatientsWidget,
  ActiveTreatmentsWidget,
  CriticalPatientsWidget,
  TodaysFollowupsWidget,
} from './PatientDashboardWidgets'
import {
  DENTAL_FLOW_WIDGET_MAP,
  DENTAL_FLOW_STAT_WIDGET_IDS,
} from '@/components/dental-flow/DentalFlowWidgets'
import {
  LAB_FLOW_WIDGET_MAP,
  LAB_FLOW_STAT_WIDGET_IDS,
} from '@/components/lab-os/LabFlowWidgets'
import {
  INVENTORY_FLOW_WIDGET_MAP,
  INVENTORY_FLOW_STAT_WIDGET_IDS,
} from '@/components/inventory-os/InventoryFlowWidgets'
import {
  ANALYTICS_FLOW_WIDGET_MAP,
  ANALYTICS_FLOW_STAT_WIDGET_IDS,
} from '@/components/analytics-os/AnalyticsFlowWidgets'
import {
  COMMUNICATION_FLOW_WIDGET_MAP,
  COMMUNICATION_FLOW_STAT_WIDGET_IDS,
} from '@/components/communication-os/CommunicationFlowWidgets'
import {
  AI_FLOW_WIDGET_MAP,
  AI_FLOW_STAT_WIDGET_IDS,
} from '@/components/ai-os/AIFlowWidgets'
import {
  SYSTEM_FLOW_WIDGET_MAP,
  SYSTEM_FLOW_STAT_WIDGET_IDS,
} from '@/components/system/SystemFlowWidgets'

/** Registry: workspace dashboard id → component */
export const DASHBOARD_WIDGET_REGISTRY = {
  todays_patients: TodaysPatientsWidget,
  revenue: RevenueWidget,
  pending_bills: PendingBillsWidget,
  followups: FollowupsStatWidget,
  lab_cases: AwaitingLabAcceptanceWidget,
  queue: QueueWidget,
  followups_panel: FollowupsPanelWidget,
  recent_patients: RecentPatientsWidget,
  active_treatments: ActiveTreatmentsWidget,
  critical_patients: CriticalPatientsWidget,
  todays_followups: TodaysFollowupsWidget,
  ...DENTAL_FLOW_WIDGET_MAP,
  ...LAB_FLOW_WIDGET_MAP,
  ...INVENTORY_FLOW_WIDGET_MAP,
  ...ANALYTICS_FLOW_WIDGET_MAP,
  ...COMMUNICATION_FLOW_WIDGET_MAP,
  ...AI_FLOW_WIDGET_MAP,
  ...SYSTEM_FLOW_WIDGET_MAP,
}

export { RecentActivityWidget } from './RecentActivityWidget'

/** Primary KPI row — always shown first, compact */
export const PRIMARY_DASHBOARD_STAT_IDS = [
  'todays_patients',
  'revenue',
  'pending_bills',
  'lab_cases',
]

/** Widgets pinned to the bottom of the dashboard */
export const BOTTOM_DASHBOARD_WIDGET_IDS = new Set(['recent_patients', 'recent_activity'])

/** Stat-card widgets rendered in the top grid */
export const DASHBOARD_STAT_WIDGET_IDS = new Set([
  'todays_patients',
  'revenue',
  'pending_bills',
  'followups',
  'lab_cases',
  'recent_patients',
  'active_treatments',
  'critical_patients',
  'todays_followups',
  'calendar',
  'ai_summary',
  'inventory_alerts',
  'broadcast',
  'notifications',
  'upcoming_appointments',
  ...DENTAL_FLOW_STAT_WIDGET_IDS,
  ...LAB_FLOW_STAT_WIDGET_IDS,
  ...INVENTORY_FLOW_STAT_WIDGET_IDS,
  ...ANALYTICS_FLOW_STAT_WIDGET_IDS,
  ...COMMUNICATION_FLOW_STAT_WIDGET_IDS,
  ...AI_FLOW_STAT_WIDGET_IDS,
  ...SYSTEM_FLOW_STAT_WIDGET_IDS,
])

export const DASHBOARD_PANEL_WIDGET_IDS = new Set(['queue', 'recent_patients', 'active_treatments', 'critical_patients', 'todays_followups'])

/** followups panel uses same flag as followups stat — rendered separately when followups enabled */
export function shouldShowFollowupsPanel(widgetIds) {
  return widgetIds.includes('followups')
}
