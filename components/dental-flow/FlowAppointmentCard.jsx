'use client'

import Link from 'next/link'
import { User, FlaskConical, AlertCircle } from 'lucide-react'
import AppointmentStatusBadge from '@/components/appointments/AppointmentStatusBadge'
import { AsyncImage } from '@/components/ui/async-image'
import { getWaitingMinutes, getTreatmentMinutes, waitColor, waitColorClass } from '@/lib/flow-waiting-timer'
import { statusLabel } from '@/lib/appointment-status'

const typeColor = t => ({
  new_patient: 'bg-purple-100 text-purple-700',
  follow_up: 'bg-blue-100 text-blue-700',
  emergency: 'bg-red-100 text-red-700',
  consultation: 'bg-[#0D9488]/15 text-[#0D9488]',
  procedure: 'bg-orange-100 text-orange-700',
}[t] || 'bg-slate-100 text-slate-700')

export default function FlowAppointmentCard({ appointment: a, compact = false, onAction, showActions = true, draggable, onDragStart, role = 'reception' }) {
  const name = a.patient_name || a.patient_name_temp || 'Walk-in'
  const waitMins = getWaitingMinutes(a)
  const treatMins = getTreatmentMinutes(a)
  const wColor = waitColor(waitMins)

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all ${a.is_emergency ? 'border-l-4 border-l-red-500' : ''}`}
    >
      <div className="p-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            <AsyncImage
              src={a.patient_photo_url}
              className="w-full h-full object-cover"
              fallback={<User className="w-5 h-5 text-muted-foreground" />}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {a.patient_id ? (
                  <Link href={`/patients/${a.patient_id}`} className="font-semibold text-sm hover:text-[#0D9488] truncate block">{name}</Link>
                ) : (
                  <span className="font-semibold text-sm truncate block">{name}</span>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">
                  {[a.patient_age != null && `${a.patient_age}y`, a.patient_gender, a.patient_phone && `+91 ${a.patient_phone}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <AppointmentStatusBadge status={a.status} />
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs font-medium text-[#0D9488]">{a.appointment_time}</span>
              {a.is_walk_in && <Badge label="Walk-in" className="bg-amber-100 text-amber-700" />}
              {a.is_follow_up && <Badge label="Follow-up" className="bg-blue-100 text-blue-700" />}
              {a.is_vip && <Badge label="VIP" className="bg-yellow-100 text-yellow-700" />}
              {a.is_emergency && <Badge label="Emergency" className="bg-red-100 text-red-700" />}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${typeColor(a.appointment_type)}`}>
                {a.appointment_type?.replace('_', ' ') || 'consultation'}
              </span>
            </div>

            {!compact && (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div>Dr. {a.doctor_name || '—'}{a.chair_name ? ` · ${a.chair_name}` : ''}</div>
                {a.chief_complaint && <div className="truncate">{a.chief_complaint}</div>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {waitMins > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium tabular-nums ${waitColorClass(wColor)}`}>
                  Wait {waitMins}m
                </span>
              )}
              {treatMins > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 tabular-nums">
                  Treat {treatMins}m
                </span>
              )}
              {a.has_outstanding_balance && (
                <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" />Pending</span>
              )}
              {a.lab_pending_count > 0 && (
                <span className="text-[10px] text-indigo-600 flex items-center gap-0.5"><FlaskConical className="w-3 h-3" />Lab</span>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">{statusLabel(a.status)}</span>
            </div>
          </div>
        </div>
      </div>
      {showActions && onAction && (
        <div className="border-t border-border px-2 py-1.5">
          <FlowQuickActions appointment={a} onAction={onAction} compact role={role} />
        </div>
      )}
    </div>
  )
}

function Badge({ label, className }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${className}`}>{label}</span>
}

function FlowQuickActions({ appointment: a, onAction, compact = false, role = 'reception' }) {
  const s = a.status
  const btn = (action, label, variant = 'outline') => (
    <button
      key={action}
      type="button"
      onClick={() => onAction(action, a)}
      className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
        variant === 'primary'
          ? 'bg-[#0D9488] text-white border-[#0D9488] hover:bg-[#0B7E73]'
          : variant === 'danger'
            ? 'text-red-600 border-red-200 hover:bg-red-50'
            : 'border-border hover:bg-muted'
      } ${compact ? 'px-1.5 py-0.5' : ''}`}
    >
      {label}
    </button>
  )

  const receptionActions = []
  if (['scheduled', 'confirmed'].includes(s)) receptionActions.push(btn('check_in', 'Check In', 'primary'))
  if (s === 'checked_in') receptionActions.push(btn('move_to_waiting', 'Waiting'))
  if (['waiting', 'checked_in'].includes(s)) receptionActions.push(btn('assign_chair', 'Assign Chair'))
  if (['waiting', 'checked_in'].includes(s)) receptionActions.push(btn('move_to_doctor', 'Doctor Ready', 'primary'))
  if (s === 'doctor_ready') receptionActions.push(btn('start_treatment', 'Start', 'primary'))
  if (s === 'in_treatment') {
    receptionActions.push(btn('pause_treatment', 'Pause'))
    receptionActions.push(btn('send_to_lab', 'Lab'))
    receptionActions.push(btn('billing', 'Billing'))
    receptionActions.push(btn('complete', 'Complete', 'primary'))
  }
  if (s === 'treatment_paused') receptionActions.push(btn('resume_treatment', 'Resume', 'primary'))
  if (s === 'lab_pending') receptionActions.push(btn('receive_from_lab', 'From Lab', 'primary'))
  if (s === 'billing') receptionActions.push(btn('complete', 'Complete', 'primary'))
  if (!['completed', 'cancelled', 'no_show', 'archived'].includes(s)) {
    receptionActions.push(btn('cancel', 'Cancel', 'danger'))
    receptionActions.push(btn('no_show', 'No Show', 'danger'))
  }

  const doctorActions = []
  if (s === 'doctor_ready') doctorActions.push(btn('start_treatment', 'Start', 'primary'))
  if (s === 'in_treatment') {
    doctorActions.push(btn('pause_treatment', 'Pause'))
    doctorActions.push(btn('send_to_lab', 'Lab'))
    doctorActions.push(btn('complete', 'Finish', 'primary'))
  }
  if (s === 'treatment_paused') doctorActions.push(btn('resume_treatment', 'Resume', 'primary'))
  if (s === 'lab_pending') doctorActions.push(btn('receive_from_lab', 'From Lab'))

  const actions = role === 'doctor' ? doctorActions : receptionActions
  if (!actions.length) return null

  return <div className="flex flex-wrap gap-1">{actions}</div>
}

export { FlowQuickActions }
