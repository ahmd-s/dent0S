'use client'

import Link from 'next/link'
import { FlaskConical, AlertCircle, GripVertical } from 'lucide-react'
import AppointmentStatusBadge from './AppointmentStatusBadge'
import BalanceBadge from '@/components/dentos/BalanceBadge'
import { formatDuration } from '@/lib/appointment-time'

const typeColor = t => ({
  new_patient: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300',
  follow_up: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  emergency: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  consultation: 'bg-[#0D9488]/15 text-[#0D9488]',
  procedure: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
}[t] || 'bg-slate-100 text-slate-700')

export default function AppointmentCard({
  appointment: a,
  compact = false,
  draggable = false,
  onDragStart,
  onClick,
  onBalanceClick,
  style,
}) {
  const name = a.patient_name || a.patient_name_temp || 'Walk-in'
  const priority = a.priority === 'high' || a.priority === 'emergency'

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      style={style}
      className={`rounded-lg border border-border bg-card p-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${priority ? 'border-l-4 border-l-red-500' : ''} ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <div className="flex items-start gap-1.5">
        {draggable && <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#0D9488] truncate">{a.appointment_time}</span>
            <AppointmentStatusBadge status={a.status} />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {a.patient_id ? (
              <Link href={`/patients/${a.patient_id}`} className="font-medium hover:text-[#0D9488] truncate" onClick={e => e.stopPropagation()}>
                {name}
              </Link>
            ) : (
              <span className="font-medium truncate">{name}</span>
            )}
            {a.patient_id && onBalanceClick && (
              <BalanceBadge patientId={a.patient_id} onClick={e => { e.stopPropagation(); onBalanceClick(a.patient_id) }} />
            )}
          </div>
          {!compact && (
            <>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {a.doctor_name || '—'}{a.chair_name ? ` · ${a.chair_name}` : ''}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${typeColor(a.appointment_type)}`}>
                  {a.appointment_type?.replace('_', ' ') || 'consultation'}
                </span>
                <span className="text-[10px] text-muted-foreground">{formatDuration(a.duration_minutes)}</span>
                {a.has_outstanding_balance && (
                  <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" />Balance</span>
                )}
                {a.lab_pending_count > 0 && (
                  <span className="text-[10px] text-indigo-600 flex items-center gap-0.5"><FlaskConical className="w-3 h-3" />Lab</span>
                )}
                {priority && <span className="text-[10px] text-red-600 font-medium">Priority</span>}
              </div>
              {a.chief_complaint && <p className="text-xs text-muted-foreground mt-1 truncate">{a.chief_complaint}</p>}
              {a.notes && <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate italic">{a.notes}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
