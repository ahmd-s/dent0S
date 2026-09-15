'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import AppointmentStatusBadge from '@/components/appointments/AppointmentStatusBadge'
import { AsyncImage } from '@/components/ui/async-image'
import { getWaitingMinutes, getTreatmentMinutes, waitColor } from '@/lib/flow-waiting-timer'
import PrimaryActions from '@/components/ui/primary-actions'

export default function FlowAppointmentCard({ appointment: a, compact = false, onAction, showActions = true, draggable, onDragStart, role = 'reception' }) {
  const name = a.patient_name || a.patient_name_temp || 'Walk-in'
  const waitMins = getWaitingMinutes(a)
  const treatMins = getTreatmentMinutes(a)
  const wColor = waitColor(waitMins)
  const waitTone = wColor === 'red' ? 'text-red-600' : wColor === 'amber' ? 'text-amber-600' : 'text-muted-foreground'

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`rounded-xl border border-border/70 bg-card ${a.is_emergency ? 'border-l-2 border-l-red-500' : ''}`}
    >
      <div className="px-4 py-3.5">
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            <AsyncImage
              src={a.patient_photo_url}
              className="w-full h-full object-cover"
              fallback={<User className="w-4 h-4 text-muted-foreground" />}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {a.patient_id ? (
                  <Link href={`/patients/${a.patient_id}`} className="font-semibold text-sm hover:underline truncate block">{name}</Link>
                ) : (
                  <span className="font-semibold text-sm truncate block">{name}</span>
                )}
                <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {a.appointment_time}
                  {a.doctor_name ? ` · Dr. ${a.doctor_name}` : ''}
                </div>
              </div>
              <AppointmentStatusBadge status={a.status} />
            </div>

            {!compact && a.chief_complaint && (
              <p className="mt-1.5 text-xs text-muted-foreground truncate">{a.chief_complaint}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
              {a.is_emergency && <span className="text-red-600 font-medium">Emergency</span>}
              {waitMins > 0 && <span className={`tabular-nums ${waitTone}`}>Wait {waitMins}m</span>}
              {treatMins > 0 && <span className="tabular-nums text-muted-foreground">Treat {treatMins}m</span>}
              {a.has_outstanding_balance && <span className="text-amber-600">Balance due</span>}
              {a.lab_pending_count > 0 && <span className="text-muted-foreground">Lab pending</span>}
            </div>
          </div>
        </div>
      </div>
      {showActions && onAction && (
        <div className="px-4 pb-3">
          <FlowQuickActions appointment={a} onAction={onAction} role={role} />
        </div>
      )}
    </div>
  )
}

function FlowQuickActions({ appointment: a, onAction, role = 'reception' }) {
  const s = a.status
  const run = (action) => () => onAction(action, a)
  const receptionActions = []
  if (['scheduled', 'confirmed'].includes(s)) receptionActions.push({ id: 'check_in', label: 'Check In', onSelect: run('check_in'), primary: true })
  if (s === 'checked_in') receptionActions.push({ id: 'move_to_waiting', label: 'Waiting', onSelect: run('move_to_waiting'), primary: true })
  if (['waiting', 'checked_in'].includes(s)) receptionActions.push({ id: 'assign_chair', label: 'Assign Chair', onSelect: run('assign_chair') })
  if (['waiting', 'checked_in'].includes(s)) receptionActions.push({ id: 'move_to_doctor', label: 'Doctor Ready', onSelect: run('move_to_doctor'), primary: true })
  if (s === 'doctor_ready') receptionActions.push({ id: 'start_treatment', label: 'Start', onSelect: run('start_treatment'), primary: true })
  if (s === 'in_treatment') {
    receptionActions.push({ id: 'complete', label: 'Complete', onSelect: run('complete'), primary: true })
    receptionActions.push({ id: 'pause_treatment', label: 'Pause', onSelect: run('pause_treatment') })
    receptionActions.push({ id: 'send_to_lab', label: 'Send to Lab', onSelect: run('send_to_lab') })
    receptionActions.push({ id: 'billing', label: 'Billing', onSelect: run('billing') })
  }
  if (s === 'treatment_paused') receptionActions.push({ id: 'resume_treatment', label: 'Resume', onSelect: run('resume_treatment'), primary: true })
  if (s === 'lab_pending') receptionActions.push({ id: 'receive_from_lab', label: 'From Lab', onSelect: run('receive_from_lab'), primary: true })
  if (s === 'billing') receptionActions.push({ id: 'complete', label: 'Complete', onSelect: run('complete'), primary: true })
  if (!['completed', 'cancelled', 'no_show', 'archived'].includes(s)) {
    receptionActions.push({ id: 'cancel', label: 'Cancel', onSelect: run('cancel'), destructive: true })
    receptionActions.push({ id: 'no_show', label: 'No Show', onSelect: run('no_show'), destructive: true })
  }

  const doctorActions = []
  if (s === 'doctor_ready') doctorActions.push({ id: 'start_treatment', label: 'Start', onSelect: run('start_treatment'), primary: true })
  if (s === 'in_treatment') {
    doctorActions.push({ id: 'complete', label: 'Finish', onSelect: run('complete'), primary: true })
    doctorActions.push({ id: 'pause_treatment', label: 'Pause', onSelect: run('pause_treatment') })
    doctorActions.push({ id: 'send_to_lab', label: 'Send to Lab', onSelect: run('send_to_lab') })
  }
  if (s === 'treatment_paused') doctorActions.push({ id: 'resume_treatment', label: 'Resume', onSelect: run('resume_treatment'), primary: true })
  if (s === 'lab_pending') doctorActions.push({ id: 'receive_from_lab', label: 'From Lab', onSelect: run('receive_from_lab'), primary: true })

  const actions = role === 'doctor' ? doctorActions : receptionActions
  return <PrimaryActions actions={actions} />
}

export { FlowQuickActions }
