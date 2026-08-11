'use client'

import { useMemo } from 'react'
import {
  Calendar,
  User,
  Stethoscope,
  Receipt,
  FlaskConical,
  Package,
  FileText,
  Sparkles,
  Users,
  Settings,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { groupEventsByDay } from '@/lib/activity-ui'
import { MODULE_LABELS } from '@/lib/activity-event-registry'

const MODULE_ICONS = {
  patients: User,
  appointments: Calendar,
  visits: Stethoscope,
  billing: Receipt,
  lab: FlaskConical,
  inventory: Package,
  consent: FileText,
  documents: FileText,
  ai: Sparkles,
  staff: Users,
  subscription: Settings,
  workspace: Settings,
  platform: Activity,
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function EventIcon({ module }) {
  const Icon = MODULE_ICONS[module] || Activity
  return (
    <div className="w-8 h-8 rounded-full bg-[#0D9488]/10 flex items-center justify-center shrink-0">
      <Icon className="w-3.5 h-3.5 text-[#0D9488]" />
    </div>
  )
}

function EventDetail({ event }) {
  const meta = event.metadata || {}
  const parts = []
  if (meta.patient_name) parts.push(meta.patient_name)
  if (meta.invoice_number) parts.push(meta.invoice_number)
  if (meta.case_number) parts.push(meta.case_number)
  if (meta.file_name) parts.push(meta.file_name)
  if (meta.amount != null) parts.push(`₹${Number(meta.amount).toLocaleString('en-IN')}`)
  if (meta.status) parts.push(String(meta.status).replace(/_/g, ' '))
  if (parts.length === 0 && event.actor_name) parts.push(`by ${event.actor_name}`)
  if (!parts.length) return null
  return <p className="text-xs text-muted-foreground mt-0.5">{parts.join(' · ')}</p>
}

export default function ActivityTimeline({
  events = [],
  loading = false,
  emptyMessage = 'No activity yet',
  className,
  compact = false,
}) {
  const groups = useMemo(() => groupEventsByDay(events), [events])

  if (loading) {
    return (
      <div className={cn('py-8 text-center text-sm text-muted-foreground', className)}>
        Loading activity…
      </div>
    )
  }

  if (!events.length) {
    return (
      <div className={cn('py-12 text-center', className)}>
        <Activity className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {groups.map(group => (
        <div key={group.label}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {group.label}
          </h3>
          <div className="relative pl-4">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
            <ul className="space-y-0">
              {group.events.map((event, i) => (
                <li key={event.id || i} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className="relative z-10">
                    <EventIcon module={event.module} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn('text-sm font-medium text-foreground', compact && 'text-xs')}>
                          {event.label}
                        </p>
                        <EventDetail event={event} />
                        {!compact && event.actor_name && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {event.actor_name}
                            {event.actor_role ? ` · ${event.actor_role}` : ''}
                            {event.module ? ` · ${MODULE_LABELS[event.module] || event.module}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {formatTime(event.created_at)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
}
