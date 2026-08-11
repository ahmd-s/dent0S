'use client'

import Link from 'next/link'
import { User, Box, AlertTriangle, Clock, FlaskConical } from 'lucide-react'
import { LAB_CASE_STATUS_META, statusLabel } from '@/lib/lab-case-helpers'

const urgencyColor = u => ({
  routine: 'bg-slate-100 text-slate-600',
  urgent: 'bg-amber-100 text-amber-700',
  emergency: 'bg-red-100 text-red-700',
}[u] || 'bg-slate-100 text-slate-600')

const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

export default function LabCaseCard({ labCase: c, onAction, showActions = true, compact = false }) {
  const badge = LAB_CASE_STATUS_META[c.status]?.badge || 'bg-slate-100 text-slate-700'

  return (
    <div className={`rounded-xl border bg-card shadow-sm hover:shadow-md transition-all ${c.is_delayed || c.overdue ? 'border-red-300/50' : 'border-border'}`}>
      <Link href={`/lab-cases/${c.id}`} className="block p-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {c.patient_photo_url ? (
              <img src={c.patient_photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm text-[#0D9488]">{c.case_number}</div>
                <div className="font-medium text-sm truncate">{c.patient_name}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${badge}`}>{statusLabel(c.status)}</span>
            </div>

            {!compact && (
              <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                <div>{c.case_type}{c.tooth_numbers ? ` · #${c.tooth_numbers}` : ''}</div>
                <div>Dr. {c.doctor_name || '—'} · {c.vendor_name || '—'}</div>
              </div>
            )}

            <div className="flex flex-wrap gap-1 mt-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${urgencyColor(c.urgency)}`}>{c.urgency || 'routine'}</span>
              {c.stl_uploaded && <Badge icon={Box} label="STL" className="bg-indigo-50 text-indigo-700" />}
              {c.impression_received && <Badge icon={FlaskConical} label="Impression" className="bg-cyan-50 text-cyan-700" />}
              {(c.is_delayed || c.overdue) && <Badge icon={AlertTriangle} label="Delayed" className="bg-red-50 text-red-600" />}
            </div>

            <div className="flex items-center justify-between mt-2 text-xs">
              <span className={`flex items-center gap-1 ${c.overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                <Clock className="w-3 h-3" />
                Due {fmtDate(c.expected_delivery_date)}
                {c.days_remaining != null && (
                  <span className={c.days_remaining < 0 ? 'text-red-600' : c.days_remaining <= 2 ? 'text-amber-600' : ''}>
                    ({c.days_remaining < 0 ? `${Math.abs(c.days_remaining)}d late` : `${c.days_remaining}d left`})
                  </span>
                )}
              </span>
              {c.estimated_completion && (
                <span className="text-muted-foreground">Est. {fmtDate(c.estimated_completion)}</span>
              )}
            </div>
          </div>
        </div>
      </Link>
      {showActions && onAction && (
        <div className="border-t border-border px-2 py-1.5">
          <LabQuickActions labCase={c} onAction={onAction} />
        </div>
      )}
    </div>
  )
}

function Badge({ label, className, icon: Icon }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${className}`}>
      {Icon && <Icon className="w-2.5 h-2.5" />}{label}
    </span>
  )
}

function LabQuickActions({ labCase: c, onAction }) {
  const s = c.status
  const btn = (action, label, variant = 'outline') => (
    <button
      key={action}
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); onAction(action, c) }}
      className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
        variant === 'primary' ? 'bg-[#0D9488] text-white border-[#0D9488]' : 'border-border hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )

  const actions = []
  if (s === 'pending') actions.push(btn('impression_ready', 'Impression Ready', 'primary'))
  if (['pending', 'impression_ready'].includes(s)) actions.push(btn('send_to_lab', 'Send to Lab', 'primary'))
  if (s === 'sent') actions.push(btn('mark_received', 'Received'))
  if (s === 'lab_received') actions.push(btn('start_manufacturing', 'Manufacturing', 'primary'))
  if (['in_production', 'in_progress'].includes(s)) actions.push(btn('start_qc', 'QC'))
  if (['in_production', 'quality_check', 'in_progress'].includes(s)) actions.push(btn('mark_ready', 'Ready', 'primary'))
  if (s === 'ready') actions.push(btn('mark_delivered', 'Delivered', 'primary'))
  if (['delivered', 'received'].includes(s)) actions.push(btn('mark_installed', 'Installed', 'primary'))
  if (['installed', 'delivered'].includes(s)) actions.push(btn('complete', 'Complete', 'primary'))
  if (!['completed', 'cancelled'].includes(s)) actions.push(btn('mark_delayed', 'Mark Delayed'))

  if (!actions.length) return null
  return <div className="flex flex-wrap gap-1">{actions}</div>
}

export { LabQuickActions }
