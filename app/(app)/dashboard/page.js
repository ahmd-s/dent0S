'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, ChevronDown, LayoutGrid, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRole } from '@/components/dentos/RoleContext'
import { useWorkspace } from '@/components/workspace/useWorkspace'
import WorkspaceWidget from '@/components/workspace/WorkspaceWidget'
import WorkspaceGate from '@/components/workspace/WorkspaceGate'
import {
  DASHBOARD_STAT_WIDGET_IDS,
  PRIMARY_DASHBOARD_STAT_IDS,
  BOTTOM_DASHBOARD_WIDGET_IDS,
  FollowupsPanelWidget,
  LabCasesSecondaryWidgets,
  shouldShowFollowupsPanel,
} from '@/components/workspace/dashboard/DashboardWidgetRegistry'
import { RecentActivityWidget } from '@/components/workspace/dashboard/RecentActivityWidget'
import BalanceBadge from '@/components/dentos/BalanceBadge'
import OutstandingBalanceModal from '@/components/dentos/OutstandingBalanceModal'
import ReceptionistPendingTasks from '@/components/dentos/ReceptionistPendingTasks'
import GettingStarted from '@/components/dentos/GettingStarted'
import { StatGridSkeleton } from '@/components/dentos/PageSkeleton'
import PatientCombobox from '@/components/dentos/PatientCombobox'
import ConflictWarnings from '@/components/appointments/ConflictWarnings'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { readAppointmentApiError } from '@/lib/appointment-api-error'
import { localTodayIso, minutesToTimeLabel, timeSlots } from '@/lib/appointment-time'

const QUEUE_TOGGLE_KEY = 'dentos_show_booking_queue'
const todayIso = () => localTodayIso()
const TIME_SLOT_LABELS = timeSlots().map(minutesToTimeLabel)
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
  const [metricsExpanded, setMetricsExpanded] = useState(false)

  const primaryStatIds = useMemo(
    () => PRIMARY_DASHBOARD_STAT_IDS.filter(id => dashboardWidgets.includes(id) && isDashboardEnabled(id)),
    [dashboardWidgets, isDashboardEnabled]
  )
  const secondaryStatIds = useMemo(
    () => dashboardWidgets.filter(
      id => DASHBOARD_STAT_WIDGET_IDS.has(id)
        && !PRIMARY_DASHBOARD_STAT_IDS.includes(id)
        && !BOTTOM_DASHBOARD_WIDGET_IDS.has(id)
    ),
    [dashboardWidgets]
  )
  const showLabSecondary = dashboardWidgets.includes('lab_cases') && isDashboardEnabled('lab_cases')
  const hasSecondaryMetrics = secondaryStatIds.length > 0 || showLabSecondary
  const showRecentPatients = dashboardWidgets.includes('recent_patients') && isDashboardEnabled('recent_patients')
  const showRecentActivity = dashboardWidgets.includes('recent_activity') && isDashboardEnabled('recent_activity')

  const showQueueWidget = dashboardWidgets.includes('queue') && isDashboardEnabled('queue')
  const showFollowupsPanel = shouldShowFollowupsPanel(dashboardWidgets)

  const load = useCallback((opts = {}) => {
    const mode = opts.mode === 'core' ? 'core' : 'full'
    const qs = mode === 'core' ? '?mode=core' : ''
    return fetch(`/api/dashboard/stats${qs}`)
      .then(r => r.json())
      .then(d => {
        setStats(prev => {
          if (mode === 'core' && prev) {
            // Preserve heavy module payloads during live refresh
            return {
              ...prev,
              ...d,
              lab: d.lab ?? prev.lab,
              inventory: d.inventory ?? prev.inventory,
              analytics: d.analytics ?? prev.analytics,
              communication: d.communication ?? prev.communication,
              ai: d.ai ?? prev.ai,
            }
          }
          return d
        })
        setStatsLoading(false)
      })
      .catch(() => {
        setStatsLoading(false)
        // Keep prior stats if a refresh fails so widgets stay usable
      })
  }, [])

  const loadFull = useCallback(() => load({ mode: 'full' }), [load])
  const loadCore = useCallback(() => load({ mode: 'core' }), [load])

  useEffect(() => { loadFull() }, [loadFull])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(QUEUE_TOGGLE_KEY)
    if (stored !== null) setShowQueue(stored === 'true')
  }, [])
  useLiveRefresh(loadCore)

  const toggleQueue = useCallback(v => {
    setShowQueue(v)
    if (typeof window !== 'undefined') localStorage.setItem(QUEUE_TOGGLE_KEY, String(v))
  }, [])

  const setStatus = useCallback(async (id, status) => {
    await fetch(`/api/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    toast.success('Updated')
    loadFull()
  }, [loadFull])

  const startVisit = useCallback(async apt => {
    const r = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: apt.id, patient_id: apt.patient_id, doctor_id: apt.doctor_id, chief_complaint: apt.chief_complaint }),
    })
    const d = await r.json()
    if (r.ok) router.push(`/visits/${d.id}`)
    else toast.error(d.error || 'Failed')
  }, [router])

  const cont = useCallback(
    apt => (apt.visit_id ? router.push(`/visits/${apt.visit_id}`) : startVisit(apt)),
    [router, startVisit]
  )

  const openBooking = useCallback(() => setBookOpen(true), [])

  // Spread into every widget, so an unmemoized object re-rendered the whole
  // dashboard grid on any state change (including each 25s refresh tick).
  const widgetProps = useMemo(() => ({
    stats,
    showQueue,
    showQueueToggle,
    toggleQueue,
    canStartVisit,
    setStatus,
    startVisit,
    cont,
    onBook: openBooking,
  }), [stats, showQueue, showQueueToggle, toggleQueue, canStartVisit, setStatus, startVisit, cont, openBooking])

  return (
    <div className={cn('max-w-7xl mx-auto space-y-4 md:space-y-5', layoutClasses)}>
      <GettingStarted stats={stats} />

      {/* Primary KPI row — full-size blocks */}
      {statsLoading && primaryStatIds.length > 0 ? (
        <StatGridSkeleton count={primaryStatIds.length} />
      ) : primaryStatIds.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {primaryStatIds.map(id => (
            <WorkspaceWidget key={id} id={id} {...widgetProps} />
          ))}
        </div>
      )}

      {/* Secondary metrics — collapsed by default */}
      {hasSecondaryMetrics && (
        <Collapsible open={metricsExpanded} onOpenChange={setMetricsExpanded}>
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5">
                <ChevronDown className={cn('w-4 h-4 transition-transform', metricsExpanded && 'rotate-180')} />
                {metricsExpanded ? 'Hide metrics' : 'More metrics'}
              </Button>
            </CollapsibleTrigger>
            <Link href="/settings/workspace" className="text-xs text-muted-foreground hover:text-[#0D9488] flex items-center gap-1">
              <LayoutGrid className="w-3.5 h-3.5" />
              Customize
            </Link>
          </div>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {secondaryStatIds.map(id => (
                <WorkspaceWidget key={id} id={id} {...widgetProps} />
              ))}
              {showLabSecondary && <LabCasesSecondaryWidgets stats={stats} />}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <WorkspaceGate section="quick_actions" flag="new_appointment">
        <QuickSearchBar onBook={openBooking} canStartVisit={canStartVisit} />
      </WorkspaceGate>

      <WorkspaceGate section="dashboard" flag="notifications">
        <ReceptionistPendingTasks />
      </WorkspaceGate>

      {(showQueueWidget || showFollowupsPanel) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
          {showQueueWidget && (
            <div className={cn('flex min-h-0', showFollowupsPanel ? 'lg:col-span-3' : 'lg:col-span-5')}>
              {statsLoading && !stats ? (
                <Card className="w-full p-4 md:p-5 animate-pulse"><div className="h-40 bg-muted rounded-lg" /></Card>
              ) : (
                <WorkspaceWidget
                  id="queue"
                  {...widgetProps}
                  className="w-full"
                />
              )}
            </div>
          )}
          {showFollowupsPanel && (
            <div className={cn('flex min-h-0', showQueueWidget ? 'lg:col-span-2' : 'lg:col-span-5')}>
              {statsLoading && !stats ? (
                <Card className="w-full p-4 md:p-5 animate-pulse"><div className="h-40 bg-muted rounded-lg" /></Card>
              ) : (
                <FollowupsPanelWidget stats={stats} className="w-full" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom section — recently viewed & activity load independently of stats */}
      {(showRecentPatients || showRecentActivity) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
          {showRecentPatients && (
            <div className={cn('flex min-h-0', showRecentActivity ? 'lg:col-span-3' : 'lg:col-span-5')}>
              <WorkspaceWidget id="recent_patients" {...widgetProps} className="w-full" />
            </div>
          )}
          {showRecentActivity && (
            <div className={cn('flex min-h-0', showRecentPatients ? 'lg:col-span-2' : 'lg:col-span-5')}>
              <RecentActivityWidget className="w-full" />
            </div>
          )}
        </div>
      )}

      <BookAppointmentModal open={bookOpen} setOpen={setBookOpen} onCreated={loadFull} />
    </div>
  )
}

const QuickSearchBar = memo(function QuickSearchBar({ onBook, canStartVisit }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const debouncedQ = useDebouncedValue(q, 300)

  useEffect(() => {
    if (!debouncedQ.trim()) { setResults([]); return }
    // Aborting on change stops a slow earlier response from overwriting the
    // results for the query the user is actually looking at.
    const controller = new AbortController()
    const params = new URLSearchParams({ q: debouncedQ, page: '1', page_size: '5' })
    fetch(`/api/patients?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => setResults(d.patients || []))
      .catch(() => {})
    return () => controller.abort()
  }, [debouncedQ])

  return (
    <>
      <Card className="p-3 md:p-4 bg-card border-border rounded-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <WorkspaceGate section="quick_actions" flag="new_patient">
            <div className="flex-1 relative min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or phone number…" className="pl-9 h-10 text-sm" />
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
            <Button onClick={onBook} className="bg-[#0D9488] hover:bg-[#0B7E73] h-10 px-4 sm:w-auto w-full">
              <Plus className="w-4 h-4 mr-1" />Quick Book
            </Button>
          </WorkspaceGate>
        </div>
      </Card>
      <OutstandingBalanceModal open={balanceModalOpen} onOpenChange={setBalanceModalOpen} patientId={selectedPatientId} />
    </>
  )
})

const BookAppointmentModal = memo(function BookAppointmentModal({ open, setOpen, onCreated }) {
  const { me } = useRole()
  const doctorId = me?.profile?.id || ''
  const emptyForm = () => ({
    patient_id: '',
    appointment_date: todayIso(),
    appointment_time: '',
    appointment_type: 'consultation',
    chief_complaint: '',
    notes: '',
  })
  const [f, setF] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [conflicts, setConflicts] = useState([])
  const [warnings, setWarnings] = useState([])

  useEffect(() => {
    if (!open) return
    setF(emptyForm())
    setConflicts([])
    setWarnings([])
    setBusy(false)
  }, [open])

  useEffect(() => {
    if (!open || !f.appointment_date || !f.appointment_time) {
      setConflicts([])
      setWarnings([])
      return
    }
    const params = new URLSearchParams({
      date: f.appointment_date,
      time: f.appointment_time,
      duration: '30',
    })
    if (doctorId) params.set('doctor_id', doctorId)
    let ignore = false
    fetch(`/api/appointments/conflicts?${params}`)
      .then(r => r.json())
      .then(d => {
        if (ignore) return
        setConflicts(d.conflicts || [])
        setWarnings(d.warnings || [])
      })
      .catch(() => {
        if (!ignore) { setConflicts([]); setWarnings([]) }
      })
    return () => { ignore = true }
  }, [open, doctorId, f.appointment_date, f.appointment_time])

  const submit = async e => {
    e.preventDefault()
    if (!f.patient_id) { toast.error('Select a patient'); return }
    if (!f.appointment_date) { toast.error('Choose a date'); return }
    if (!f.appointment_time) { toast.error('Choose a time'); return }
    if (conflicts.length) {
      toast.error(conflicts[0].message || 'This slot is already booked. Choose another time.')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, doctor_id: doctorId || undefined }),
      })
      if (r.ok) {
        toast.success('Appointment booked')
        setOpen(false)
        onCreated && onCreated()
        return
      }
      const { message } = await readAppointmentApiError(r)
      console.error('Quick Book failed:', r.status, message)
      toast.error(message)
    } catch (err) {
      console.error('Quick Book network error:', err?.name || 'Error')
      toast.error('Could not book the appointment. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Quick Book Appointment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="quick-book-patient">Patient</Label>
            <PatientCombobox
              id="quick-book-patient"
              value={f.patient_id}
              onChange={v => setF({ ...f, patient_id: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.appointment_date} onChange={e => setF({ ...f, appointment_date: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-book-time">Time</Label>
              <select
                id="quick-book-time"
                value={f.appointment_time}
                onChange={e => setF({ ...f, appointment_time: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select time</option>
                {TIME_SLOT_LABELS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <ConflictWarnings conflicts={conflicts} warnings={warnings} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy} className="bg-[#0D9488] hover:bg-[#0B7E73]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Book'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
})

export default App
