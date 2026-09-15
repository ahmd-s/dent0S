'use client'

import { GripVertical, AlertCircle } from 'lucide-react'
import AppointmentStatusBadge from './AppointmentStatusBadge'
import BalanceBadge from '@/components/dentos/BalanceBadge'
import { formatDuration } from '@/lib/appointment-time'

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
  const priority = a.priority === 'high' || a.priority === 'emergency' || a.is_emergency

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      style={style}
      className={`rounded-xl border border-border/70 bg-card px-3 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer ${priority ? 'border-l-2 border-l-red-500' : ''} ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <div className="flex items-start gap-1.5">
        {draggable && <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-foreground truncate">{name}</div>
              <div className="text-muted-foreground mt-0.5 tabular-nums">
                {a.appointment_time}
                {!compact && a.duration_minutes ? ` · ${formatDuration(a.duration_minutes)}` : ''}
              </div>
            </div>
            <AppointmentStatusBadge status={a.status} />
          </div>
          {!compact && (
            <div className="mt-1.5 text-xs text-muted-foreground truncate">
              {[a.doctor_name, a.chair_name, a.appointment_type?.replace('_', ' ')].filter(Boolean).join(' · ')}
            </div>
          )}
          {(a.has_outstanding_balance || a.lab_pending_count > 0 || priority) && (
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
              {a.patient_id && onBalanceClick && (
                <BalanceBadge patientId={a.patient_id} onClick={e => { e.stopPropagation(); onBalanceClick(a.patient_id) }} />
              )}
              {a.has_outstanding_balance && (
                <span className="text-amber-600 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" />Balance</span>
              )}
              {a.lab_pending_count > 0 && <span className="text-muted-foreground">Lab pending</span>}
              {priority && <span className="text-red-600 font-medium">Urgent</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
