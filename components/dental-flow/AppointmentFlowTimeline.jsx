'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, Circle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getEventLabel } from '@/lib/activity-event-registry'

const STAGE_ORDER = [
  'APPOINTMENT_CREATED',
  'PATIENT_CHECKED_IN',
  'APPOINTMENT_CHECKED_IN',
  'CHAIR_ASSIGNED',
  'DOCTOR_READY',
  'TREATMENT_STARTED',
  'TREATMENT_PAUSED',
  'TREATMENT_RESUMED',
  'LAB_SENT',
  'LAB_RECEIVED',
  'BILLING_STARTED',
  'PAYMENT_RECEIVED',
  'VISIT_COMPLETED',
  'APPOINTMENT_COMPLETED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_RESCHEDULED',
  'NO_SHOW',
  'APPOINTMENT_NO_SHOW',
]

export default function AppointmentFlowTimeline({ appointmentId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!appointmentId) return
    setLoading(true)
    fetch(`/api/timeline/appointment/${appointmentId}?limit=50`)
      .then(r => r.json())
      .then(d => {
        const sorted = (d.events || []).sort((a, b) => {
          const ia = STAGE_ORDER.indexOf(a.event)
          const ib = STAGE_ORDER.indexOf(b.event)
          if (ia !== ib) return ia - ib
          return new Date(a.created_at) - new Date(b.created_at)
        })
        setEvents(sorted)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [appointmentId])

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#0D9488]" /></div>
  }

  if (!events.length) {
    return <p className="text-sm text-muted-foreground py-4">No timeline events yet</p>
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-4">Appointment Timeline</h3>
      <div className="relative">
        {events.map((e, i) => (
          <div key={e.id || i} className="flex gap-3 pb-4 last:pb-0">
            <div className="flex flex-col items-center">
              <CheckCircle2 className="w-4 h-4 text-[#0D9488] flex-shrink-0" />
              {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-sm font-medium">{getEventLabel(e.event)}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                {e.actor?.name && ` · ${e.actor.name}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Compact stage indicator for patient workspace */
export function FlowStageIndicator({ events = [] }) {
  const completed = new Set(events.map(e => e.event))
  const stages = [
    { key: 'APPOINTMENT_CREATED', label: 'Booked' },
    { key: 'PATIENT_CHECKED_IN', label: 'Checked In' },
    { key: 'CHAIR_ASSIGNED', label: 'Chair' },
    { key: 'DOCTOR_READY', label: 'Doctor Ready' },
    { key: 'TREATMENT_STARTED', label: 'Treatment' },
    { key: 'VISIT_COMPLETED', label: 'Completed' },
  ]

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {stages.map((s, i) => {
        const done = completed.has(s.key) || completed.has('APPOINTMENT_CHECKED_IN') && s.key === 'PATIENT_CHECKED_IN'
        return (
          <div key={s.key} className="flex items-center gap-1 flex-shrink-0">
            {done ? <CheckCircle2 className="w-3 h-3 text-[#0D9488]" /> : <Circle className="w-3 h-3 text-muted-foreground/40" />}
            <span className={`text-[10px] ${done ? 'text-[#0D9488] font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < stages.length - 1 && <span className="text-muted-foreground/30 mx-0.5">→</span>}
          </div>
        )
      })}
    </div>
  )
}
