'use client'

import { STATUS_COLORS, statusLabel } from '@/lib/appointment-status'

export default function AppointmentStatusBadge({ status, className = '' }) {
  const s = status || 'scheduled'
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap ${STATUS_COLORS[s] || STATUS_COLORS.scheduled} ${className}`}>
      {statusLabel(s)}
    </span>
  )
}
