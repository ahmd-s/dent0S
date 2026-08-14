'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useWorkspace } from '@/components/workspace/useWorkspace'
import { isActionEnabled } from '@/lib/workspace-client'
import { todayIso, weekDates } from '@/lib/appointment-time'
import { normalizeStatus } from '@/lib/appointment-status'
import CalendarToolbar from '@/components/appointments/CalendarToolbar'
import AppointmentCalendar from '@/components/appointments/AppointmentCalendar'
import QueueBoard from '@/components/appointments/QueueBoard'
import ReceptionDashboard from '@/components/dental-flow/ReceptionDashboard'
import ChairBoard from '@/components/dental-flow/ChairBoard'
import FlowQueueBoard from '@/components/dental-flow/FlowQueueBoard'
import DoctorFlowDashboard from '@/components/dental-flow/DoctorFlowDashboard'
import WalkInModal from '@/components/appointments/WalkInModal'
import ConflictWarnings from '@/components/appointments/ConflictWarnings'
import AppointmentCard from '@/components/appointments/AppointmentCard'
import OutstandingBalanceModal from '@/components/dentos/OutstandingBalanceModal'
import NewAppointmentModal from '@/components/appointments/NewAppointmentModal'

const VIEW_STORAGE_KEY = 'dentos_calendar_view'

function getDateRange(view, date) {
  if (view === 'week') {
    const days = weekDates(date)
    return { from: days[0], to: days[6] }
  }
  if (view === 'month') {
    const d = new Date(date + 'T00:00:00')
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { from, to }
  }
  return { from: date, to: date }
}

export default function AppointmentsPage() {
  const router = useRouter()
  const { config } = useWorkspace()
  const canCreate = isActionEnabled(config, 'appointment_page', 'create')
  const canEdit = isActionEnabled(config, 'appointment_page', 'edit')
  const canCancel = isActionEnabled(config, 'appointment_page', 'cancel')
  const canCheckIn = isActionEnabled(config, 'appointment_page', 'mark_arrived')

  const [date, setDate] = useState(todayIso())
  const [view, setViewState] = useState('day')
  const [list, setList] = useState([])
  const [doctors, setDoctors] = useState([])
  const [chairs, setChairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [dragId, setDragId] = useState(null)
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [prefillPatient, setPrefillPatient] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY)
    if (saved) setViewState(saved)
    const url = new URL(window.location.href)
    const pid = url.searchParams.get('patient')
    const pname = url.searchParams.get('patientName')
    if (pid) {
      setPrefillPatient(pname ? { id: pid, name: decodeURIComponent(pname) } : { id: pid })
      setOpen(true)
    }
  }, [])

  const setView = v => {
    setViewState(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  const load = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true)
    const { from, to } = getDateRange(view, date)
    const params = view === 'day' || view === 'queue' || view === 'doctor' || view === 'chair'
      || view === 'reception' || view === 'flow' || view === 'chairs' || view === 'doctor_flow'
      ? `date=${date}`
      : `date_from=${from}&date_to=${to}`
    const [apptRes, docRes, chairRes] = await Promise.all([
      fetch(`/api/appointments?${params}`),
      fetch('/api/doctors'),
      fetch('/api/chairs'),
    ])
    const [apptData, docData, chairData] = await Promise.all([apptRes.json(), docRes.json(), chairRes.json()])
    setList(apptData.appointments || [])
    setDoctors(docData.doctors || [])
    setChairs(chairData.chairs || [])
    if (!silent) setLoading(false)
  }, [date, view])

  useEffect(() => { load() }, [load])
  useLiveRefresh(() => load({ silent: true }), [date, view])

  const summary = useMemo(() => ({
    scheduled: list.filter(a => ['scheduled', 'confirmed'].includes(normalizeStatus(a.status))).length,
    waiting: list.filter(a => ['waiting', 'checked_in', 'called', 'arrived'].includes(a.status)).length,
    completed: list.filter(a => a.status === 'completed').length,
    cancelled: list.filter(a => ['cancelled', 'no_show'].includes(a.status)).length,
  }), [list])

  const setStatus = async (id, status) => {
    const r = await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (r.ok) { toast.success('Updated'); load(); setSelected(null) }
    else toast.error((await r.json()).message || 'Failed')
  }

  const startVisit = async (a) => {
    if (a.status !== 'called' && a.status !== 'doctor_ready' && a.status !== 'checked_in' && a.status !== 'arrived' && a.status !== 'waiting') {
      await setStatus(a.id, 'checked_in')
    }
    const r = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: a.patient_id || null, appointment_id: a.id }),
    })
    const d = await r.json()
    if (r.ok) router.push(`/visits/${d.id}`)
    else toast.error(d.error || 'Failed')
  }

  const onDropAppointment = async (id, update) => {
    if (!canEdit) { toast.error('Editing disabled for your role'); return }
    const checkParams = new URLSearchParams({
      date: update.appointment_date,
      time: update.appointment_time,
      duration: '30',
      exclude_id: id,
    })
    if (update.doctor_id) checkParams.set('doctor_id', update.doctor_id)
    if (update.chair_id) checkParams.set('chair_id', update.chair_id)
    const check = await fetch(`/api/appointments/conflicts?${checkParams}`)
    const checkData = await check.json()
    if (checkData.hasConflict) {
      setConflicts(checkData.conflicts || [])
      toast.error(checkData.conflicts?.[0]?.message || 'Conflict detected')
      return
    }
    setConflicts([])
    const r = await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (r.ok) { toast.success('Appointment moved'); load() }
    else toast.error((await r.json()).message || 'Failed to move')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <CalendarToolbar
        date={date}
        setDate={setDate}
        view={view}
        setView={setView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onNewAppointment={() => canCreate ? setOpen(true) : toast.error('Not permitted')}
        onWalkIn={() => canCreate ? setWalkInOpen(true) : toast.error('Not permitted')}
        summary={summary}
      />

      <ConflictWarnings conflicts={conflicts} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" /></div>
      ) : view === 'reception' ? (
        <ReceptionDashboard date={date} onRefresh={load} />
      ) : view === 'flow' ? (
        <FlowQueueBoard date={date} onRefresh={load} onStartVisit={startVisit} />
      ) : view === 'chairs' ? (
        <ChairBoard date={date} onRefresh={load} />
      ) : view === 'doctor_flow' ? (
        <DoctorFlowDashboard date={date} onRefresh={load} />
      ) : view === 'queue' ? (
        <QueueBoard date={date} onRefresh={load} onStartVisit={startVisit} onBalanceClick={pid => { setSelectedPatientId(pid); setBalanceModalOpen(true) }} />
      ) : list.length === 0 && view === 'day' ? (
        <Card className="py-16 text-center">
          <Calendar className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">No appointments for this date</p>
          {canCreate && (
            <Button onClick={() => setOpen(true)} className="mt-3 bg-[#0D9488] hover:bg-[#0B7E73]">Add First Appointment</Button>
          )}
        </Card>
      ) : (
        <AppointmentCalendar
          view={view}
          date={date}
          appointments={list}
          doctors={doctors}
          chairs={chairs}
          searchQuery={searchQuery}
          onDropAppointment={canEdit ? onDropAppointment : undefined}
          onSelectAppointment={setSelected}
          onBalanceClick={pid => { setSelectedPatientId(pid); setBalanceModalOpen(true) }}
          dragAppointmentId={dragId}
          setDragAppointmentId={setDragId}
        />
      )}

      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Appointment</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <AppointmentCard appointment={selected} />
              <div className="flex flex-wrap gap-2">
                {canCheckIn && ['scheduled', 'confirmed'].includes(selected.status) && (
                  <Button size="sm" className="bg-blue-600" onClick={() => setStatus(selected.id, 'checked_in')}>Check In</Button>
                )}
                {canCheckIn && selected.status === 'checked_in' && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(selected.id, 'waiting')}>Move to Waiting</Button>
                )}
                {['called', 'doctor_ready'].includes(selected.status) && (
                  <Button size="sm" className="bg-[#0D9488]" onClick={() => startVisit(selected)}>Start Visit</Button>
                )}
                {selected.visit_id && (
                  <Button size="sm" variant="outline" onClick={() => router.push(`/visits/${selected.visit_id}`)}>Open Visit</Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(selected.id, 'confirmed')}>Confirm</Button>
                )}
                {canCancel && (
                  <>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => setStatus(selected.id, 'cancelled')}>Cancel</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(selected.id, 'no_show')}>No Show</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NewAppointmentModal open={open} setOpen={v => { setOpen(v); if (!v) setPrefillPatient(null) }} initialDate={date} onCreated={load} prefillPatient={prefillPatient} chairs={chairs} doctors={doctors} />
      <WalkInModal open={walkInOpen} setOpen={setWalkInOpen} date={date} onCreated={load} />
      <OutstandingBalanceModal open={balanceModalOpen} onOpenChange={setBalanceModalOpen} patientId={selectedPatientId} />
    </div>
  )
}
