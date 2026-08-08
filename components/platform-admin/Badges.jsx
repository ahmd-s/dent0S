'use client'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TONES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  red: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
  violet: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  slate: 'border-border bg-muted text-muted-foreground hover:bg-muted',
}

export function ToneBadge({ tone = 'slate', className, children, ...props }) {
  return (
    <Badge variant="outline" className={cn('font-medium', TONES[tone] || TONES.slate, className)} {...props}>
      {children}
    </Badge>
  )
}

export function StatusBadge({ active }) {
  return <ToneBadge tone={active ? 'green' : 'slate'}>{active ? 'Active' : 'Inactive'}</ToneBadge>
}

export function AccessBadge({ status }) {
  const blocked = status === 'blocked'
  return <ToneBadge tone={blocked ? 'red' : 'green'}>{blocked ? 'Blocked' : 'Allowed'}</ToneBadge>
}

const BILLING_TONES = {
  trial: 'blue',
  active: 'green',
  halted: 'amber',
  cancelled: 'red',
  blocked: 'red',
}

export function BillingBadge({ status }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return <ToneBadge tone={BILLING_TONES[status] || 'slate'} className="capitalize">{status}</ToneBadge>
}

export function PlanBadge({ plan }) {
  if (!plan) return <span className="text-muted-foreground">—</span>
  return <ToneBadge tone="violet" className="capitalize">{plan}</ToneBadge>
}

export function OverrideBadge({ status }) {
  if (!status) return null
  return <ToneBadge tone={status === 'locked' ? 'red' : 'amber'} className="capitalize">Override: {status}</ToneBadge>
}
