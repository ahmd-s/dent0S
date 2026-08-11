'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRole } from '@/components/dentos/RoleContext'
import { useWorkspace } from '@/components/workspace/useWorkspace'
import WorkspaceWidget from '@/components/workspace/WorkspaceWidget'
import WorkspaceGate from '@/components/workspace/WorkspaceGate'
import { DASHBOARD_STAT_WIDGET_IDS, DASHBOARD_PANEL_WIDGET_IDS, FollowupsPanelWidget, shouldShowFollowupsPanel } from '@/components/workspace/dashboard/DashboardWidgetRegistry'
import { RecentActivityWidget } from '@/components/workspace/dashboard/RecentActivityWidget'
import BalanceBadge from '@/components/dentos/BalanceBadge'
import OutstandingBalanceModal from '@/components/dentos/OutstandingBalanceModal'
import ReceptionistPendingTasks from '@/components/dentos/ReceptionistPendingTasks'
import GettingStarted from '@/components/dentos/GettingStarted'
import { StatGridSkeleton } from '@/components/dentos/PageSkeleton'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'

const QUEUE_TOGGLE_KEY = 'dentos_show_booking_queue'
const todayIso = () => new Date().toISOString().slice(0, 10)
const fmtDate = d => {
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}

function App() {
  const router = useRouter()
  const { canAccessClinical, isDoctor } = useRole()
  const { dashboardWidgets, layoutClasses, isDashboardEnabled } = useWorkspace()
  const canStartVisit = canAccessClinical()
  const showQueueToggle = isDoctor()
  const [showQueue, setShowQueue] = useState(true)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [bookOpen, setBookOpen] = useState(false)

  const statWidgetIds = useMemo(
    () => dashboardWidgets.filter(id => DASHBOARD_STAT_WIDGET_IDS.has(id)),
    [dashboardWidgets]
  )
  const showQueueWidget = dashboardWidgets.includes('queue') && isDashboardEnabled('queue')
  const showFollowupsPanel = shouldShowFollowupsPanel(dashboardWidgets)
  const patientPanelIds = useMemo(
    () => dashboardWidgets.filter(id => ['recent_patients', 'active_treatments', 'critical_patients', 'todays_followups'].includes(id) && isDashboardEnabled(id)),
    [dashboardWidgets, isDashboardEnabled]
  )

  const load = () => fetch('/api/dashboard/stats').then(r => r.json()).then(d => { setStats(d); setStatsLoading(false) })
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(QUEUE_TOGGLE_KEY)
    if (stored !== null) setShowQueue(stored === 'true')
  }, [])
  useLiveRefresh(load)

  const toggleQueue = v => {
    setShowQueue(v)
    if (typeof window !== 'undefined') localStorage.setItem(QUEUE_TOGGLE_KEY, String(v))
  }

  const setStatus = async (id, status) => {
    await fetch(`/api/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    toast.success('Updated')
    load()
  }
  const startVisit = async apt => {
    const r = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: apt.id, patient_id: apt.patient_id, doctor_id: apt.doctor_id, chief_complaint: apt.chief_complaint }),
    })
    const d = await r.json()
    if (r.ok) router.push(`/visits/${d.id}`)
    else toast.error(d.error || 'Failed')
  }
  const cont = apt => (apt.visit_id ? router.push(`/visits/${apt.visit_id}`) : startVisit(apt))

  const widgetProps = {
    stats,
    showQueue,
    showQueueToggle,
    toggleQueue,
    canStartVisit,
    setStatus,
    startVisit,
    cont,
    onBook: () => setBookOpen(true),
  }

  return (
    <div className={cn('max-w-7xl mx-auto space-y-4 md:space-y-5', layoutClasses)}>
      <GettingStarted stats={stats} />

      {statsLoading && statWidgetIds.length > 0 ? (
        <StatGridSkeleton count={Math.min(statWidgetIds.length, 4)} />
      ) : statWidgetIds.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statWidgetIds.map(id => (
            <WorkspaceWidget key={id} id={id} {...widgetProps} />
          ))}
        </div>
      )}

      <WorkspaceGate section="quick_actions" flag="new_appointment">
        <QuickSearchBar onBook={() => setBookOpen(true)} canStartVisit={canStartVisit} />
      </WorkspaceGate>

      <WorkspaceGate section="dashboard" flag="notifications">
        <ReceptionistPendingTasks />
      </WorkspaceGate>

      {(showQueueWidget || showFollowupsPanel) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
          {showQueueWidget && (
            <WorkspaceWidget
              id="queue"
              {...widgetProps}
              className={showFollowupsPanel ? 'lg:col-span-3' : 'lg:col-span-5'}
            />
          )}
          {showFollowupsPanel && (
            <div className={showQueueWidget ? 'lg:col-span-2' : 'lg:col-span-5'}>
              <FollowupsPanelWidget stats={stats} />
            </div>
          )}
        </div>
      )}

      {patientPanelIds.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {patientPanelIds.map(id => (
            <WorkspaceWidget key={id} id={id} {...widgetProps} />
          ))}
        </div>
      )}

      {dashboardWidgets.includes('recent_activity') && (
        <RecentActivityWidget />
      )}

      <BookAppointmentModal open={bookOpen} setOpen={setBookOpen} onCreated={load} />
    </div>
  )
}

function QuickSearchBar({ onBook, canStartVisit }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const debRef = useRef(null)

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current)
    if (!q.trim()) { setResults([]); return }
    debRef.current = setTimeout(async () => {
      const r = await fetch(`/api/patients?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      setResults((d.patients || []).slice(0, 5))
    }, 300)
  }, [q])

  return (
    <>
      <Card className="p-4 md:p-5 bg-card border-border rounded-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <WorkspaceGate section="quick_actions" flag="new_patient">
            <div className="flex-1 relative min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or phone number…" className="pl-9 h-11 text-base" />
              {q && (
                <div className="absolute top-12 left-0 right-0 bg-card border border-border rounded-md shadow-lg z-10 max-h-96 overflow-y-auto">
                  {results.length === 0 ? (
                    <div className="p-3 text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">No patient found.</span>
                      {canStartVisit && (
                        <Link href="/patients" className="text-[#0D9488] hover:underline flex items-center gap-1">
                          <Plus className="w-3 h-3" />Add New Patient
                        </Link>
                      )}
                    </div>
                  ) : (
                    results.map(p => (
                      <button key={p.id} onClick={() => router.push(`/patients/${p.id}`)} className="w-full text-left px-4 py-2.5 hover:bg-muted border-b border-border last:border-0 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground">+91 {p.phone}</div>
                          </div>
                          <BalanceBadge
                            patientId={p.id}
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedPatientId(p.id)
                              setBalanceModalOpen(true)
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{p.last_visit_date ? `Last: ${fmtDate(p.last_visit_date)}` : 'No visits'}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </WorkspaceGate>
          <WorkspaceGate section="quick_actions" flag="new_appointment">
            <Button onClick={onBook} className="bg-[#0D9488] hover:bg-[#0B7E73] h-11 px-4 sm:w-auto w-full">
              <Plus className="w-4 h-4 mr-1" />Quick Book
            </Button>
          </WorkspaceGate>
        </div>
      </Card>
      <OutstandingBalanceModal open={balanceModalOpen} onOpenChange={setBalanceModalOpen} patientId={selectedPatientId} />
    </>
  )
}

function BookAppointmentModal({ open, setOpen, onCreated }) {
  const [patients, setPatients] = useState([])
  const [f, setF] = useState({ patient_id: '', appointment_date: todayIso(), appointment_time: '10:00 AM', appointment_type: 'consultation', chief_complaint: '', notes: '' })
  useEffect(() => {
    if (open) fetch('/api/patients').then(r => r.json()).then(d => setPatients(d.patients || []))
  }, [open])
  const submit = async e => {
    e.preventDefault()
    if (!f.patient_id) { toast.error('Select patient'); return }
    const r = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    if (r.ok) { toast.success('Appointment booked'); setOpen(false); onCreated && onCreated() }
    else toast.error('Failed')
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Quick Book Appointment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={v => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · +91 {p.phone}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.appointment_date} onChange={e => setF({ ...f, appointment_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Time</Label><Input value={f.appointment_time} onChange={e => setF({ ...f, appointment_time: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-[#0D9488] hover:bg-[#0B7E73]">Book</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
