'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock, Armchair, Stethoscope } from 'lucide-react'
import { Card } from '@/components/ui/card'
import AppointmentStatusBadge from '@/components/appointments/AppointmentStatusBadge'
import { FlowStageIndicator } from '@/components/dental-flow/AppointmentFlowTimeline'
import AppointmentFlowTimeline from '@/components/dental-flow/AppointmentFlowTimeline'
import { getWaitingMinutes, waitColorClass, waitColor } from '@/lib/flow-waiting-timer'
import { normalizeStatus, isInQueue } from '@/lib/appointment-status'
import { todayIso } from '@/lib/appointment-time'

export default function PatientFlowStatus({ patientId, appointments = [] }) {
  const [timelineEvents, setTimelineEvents] = useState([])
  const today = todayIso()

  const current = useMemo(() => {
    const todayAppts = appointments.filter(a => a.appointment_date === today && isInQueue(a.status))
    const active = todayAppts.sort((a, b) => {
      const order = { in_treatment: 0, doctor_ready: 1, waiting: 2, checked_in: 3 }
      return (order[normalizeStatus(a.status)] ?? 99) - (order[normalizeStatus(b.status)] ?? 99)
    })
    return active[0] || appointments.find(a => a.appointment_date === today) || null
  }, [appointments, today])

  const upcoming = useMemo(() =>
    appointments.filter(a => a.appointment_date >= today && ['scheduled', 'confirmed'].includes(normalizeStatus(a.status)))
      .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
      .slice(0, 3),
  [appointments, today])

  const noShows = useMemo(() =>
    appointments.filter(a => normalizeStatus(a.status) === 'no_show').length,
  [appointments])

  useEffect(() => {
    if (!current?.id) return
    fetch(`/api/timeline/appointment/${current.id}?limit=20`)
      .then(r => r.json())
      .then(d => setTimelineEvents(d.events || []))
      .catch(() => {})
  }, [current?.id])

  if (!current && !upcoming.length) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">No active appointment today</p>
        {upcoming.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Upcoming</h4>
            {upcoming.map(a => <UpcomingRow key={a.id} a={a} />)}
          </div>
        )}
      </Card>
    )
  }

  const waitMins = current ? getWaitingMinutes(current) : 0

  return (
    <div className="space-y-4">
      {current && (
        <Card className="p-4 border-[#0D9488]/20">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-sm">Current Appointment</h3>
              <p className="text-xs text-muted-foreground">{current.appointment_date} · {current.appointment_time}</p>
            </div>
            <AppointmentStatusBadge status={current.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <MiniStat icon={Stethoscope} label="Doctor" value={current.doctor_name || '—'} />
            <MiniStat icon={Armchair} label="Chair" value={current.chair_name || '—'} />
            <MiniStat icon={Clock} label="Waiting" value={waitMins > 0 ? `${waitMins}m` : '—'} className={waitMins > 0 ? waitColorClass(waitColor(waitMins)) : ''} />
            <MiniStat icon={Clock} label="Stage" value={current.status?.replace(/_/g, ' ')} />
          </div>

          <FlowStageIndicator events={timelineEvents} />
        </Card>
      )}

      {current && <AppointmentFlowTimeline appointmentId={current.id} />}

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-2">Appointment History</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {appointments.slice(0, 10).map(a => (
            <div key={a.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
              <span>{a.appointment_date} · {a.appointment_time}</span>
              <AppointmentStatusBadge status={a.status} />
            </div>
          ))}
        </div>
        {noShows > 0 && (
          <p className="text-xs text-muted-foreground mt-2">{noShows} previous no-show{noShows > 1 ? 's' : ''}</p>
        )}
      </Card>

      {upcoming.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-2">Upcoming Appointments</h4>
          {upcoming.map(a => <UpcomingRow key={a.id} a={a} />)}
        </Card>
      )}
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`text-center p-2 rounded-lg bg-muted/50 ${className}`}>
      <Icon className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-medium truncate capitalize">{value}</div>
    </div>
  )
}

function UpcomingRow({ a }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5">
      <span>{a.appointment_date} · {a.appointment_time}</span>
      <span className="text-xs text-muted-foreground capitalize">{a.appointment_type?.replace('_', ' ')}</span>
    </div>
  )
}
