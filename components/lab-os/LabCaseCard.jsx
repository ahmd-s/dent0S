'use client'

import Link from 'next/link'
import { statusLabel } from '@/lib/lab-case-helpers'
import PrimaryActions from '@/components/ui/primary-actions'

const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

function treatmentLabel(c) {
  const type = c.case_type || 'Lab case'
  return c.tooth_numbers ? `${type} · #${c.tooth_numbers}` : type
}

export function getLabCaseActions(c, onAction) {
  const s = c.status
  const run = (action) => () => onAction(action, c)
  const actions = []
  if (s === 'pending') actions.push({ id: 'impression_ready', label: 'Impression Ready', onSelect: run('impression_ready') })
  if (['pending', 'impression_ready'].includes(s)) actions.push({ id: 'send_to_lab', label: 'Send to Lab', onSelect: run('send_to_lab'), primary: true })
  if (s === 'sent') actions.push({ id: 'mark_received', label: 'Received', onSelect: run('mark_received'), primary: true })
  if (s === 'lab_received') actions.push({ id: 'start_manufacturing', label: 'Manufacturing', onSelect: run('start_manufacturing'), primary: true })
  if (['in_production', 'in_progress'].includes(s)) actions.push({ id: 'start_qc', label: 'Quality Check', onSelect: run('start_qc') })
  if (['in_production', 'quality_check', 'in_progress'].includes(s)) actions.push({ id: 'mark_ready', label: 'Mark Ready', onSelect: run('mark_ready'), primary: true })
  if (s === 'ready') actions.push({ id: 'mark_delivered', label: 'Delivered', onSelect: run('mark_delivered'), primary: true })
  if (['delivered', 'received'].includes(s)) actions.push({ id: 'mark_installed', label: 'Installed', onSelect: run('mark_installed'), primary: true })
  if (['installed', 'delivered'].includes(s)) actions.push({ id: 'complete', label: 'Complete', onSelect: run('complete'), primary: true })
  if (!['completed', 'cancelled'].includes(s)) actions.push({ id: 'mark_delayed', label: 'Mark Delayed', onSelect: run('mark_delayed') })
  return actions
}

export default function LabCaseCard({ labCase: c, onAction, showActions = true }) {
  const overdue = !!(c.is_delayed || c.overdue)
  const showPriority = c.urgency === 'emergency' || c.urgency === 'urgent'
  const actions = showActions && onAction ? getLabCaseActions(c, onAction) : []

  return (
    <div className="rounded-xl border border-border/70 bg-card hover:border-border hover:bg-muted/20 transition-colors">
      <Link href={`/lab-cases/${c.id}`} className="block px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground truncate leading-snug">
              {c.patient_name || 'Unknown patient'}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground truncate">{treatmentLabel(c)}</p>
          </div>
          {showPriority && (
            <span className={`text-[11px] font-medium shrink-0 mt-0.5 ${c.urgency === 'emergency' ? 'text-red-600' : 'text-amber-600'}`}>
              {c.urgency === 'emergency' ? 'Emergency' : 'Urgent'}
            </span>
          )}
        </div>

        <div className="mt-3.5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-foreground">{statusLabel(c.status)}</div>
            {c.vendor_name && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.vendor_name}</div>
            )}
          </div>
          <div className={`text-sm tabular-nums text-right shrink-0 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            Due {fmtDate(c.expected_delivery_date)}
          </div>
        </div>
      </Link>

      {actions.length > 0 && (
        <div className="px-5 pb-3.5 -mt-1">
          <PrimaryActions actions={actions} />
        </div>
      )}
    </div>
  )
}

export function LabQuickActions({ labCase: c, onAction }) {
  return <PrimaryActions actions={getLabCaseActions(c, onAction)} />
}
