'use client'
import {
  Ban,
  Brain,
  CreditCard,
  KeyRound,
  LogIn,
  ShieldAlert,
  Timer,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtAction, fmtDateTime, fmtMoney } from './format'

const ICONS = {
  login_password_success: { icon: LogIn, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300' },
  login_totp_success: { icon: KeyRound, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300' },
  totp_setup_completed: { icon: KeyRound, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300' },
  login_password_failed: { icon: ShieldAlert, tone: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-300' },
  login_totp_failed: { icon: ShieldAlert, tone: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-300' },
  login_locked: { icon: Ban, tone: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-300' },
  subscription_status_changed: { icon: CreditCard, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-300' },
  clinic_access_status_changed: { icon: Ban, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300' },
  manual_payment_recorded: { icon: CreditCard, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300' },
  ai_usage_limit_changed: { icon: Brain, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300' },
  trial_expired_auto_blocked: { icon: Timer, tone: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-300' },
  trial_auto_enforcement_changed: { icon: Timer, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300' },
}

function detailParts(log) {
  const parts = []
  if (log.meta?.ip) parts.push(`IP ${log.meta.ip}`)
  if (log.meta?.from !== undefined) parts.push(`${log.meta.from ?? 'none'} → ${log.meta.to ?? 'none'}`)
  if (log.meta?.amount != null) {
    parts.push(`${fmtMoney(log.meta.amount)} via ${log.meta.method || '—'}`)
    if (log.meta.date) parts.push(`dated ${log.meta.date}`)
  }
  if (log.meta?.note) parts.push(log.meta.note)
  return parts
}

export function AuditTimeline({ logs, showClinic = true, emptyLabel = 'No audit entries yet' }) {
  if (!logs?.length) {
    return (
      <div className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <ol className="relative space-y-1 pl-2">
      <span className="absolute left-[19px] top-3 bottom-3 w-px bg-border" aria-hidden="true" />
      {logs.map(log => {
        const { icon: Icon = Activity, tone = 'text-muted-foreground bg-muted' } = ICONS[log.action] || {}
        const parts = detailParts(log)
        return (
          <li key={log.id} className="relative flex gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40">
            <span className={cn('z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background', tone)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium capitalize text-foreground">{fmtAction(log.action)}</p>
                <time className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(log.at)}</time>
              </div>
              <p className="text-xs text-muted-foreground">
                {log.actor_email || 'System'}
                {showClinic && log.target_clinic_name ? ` · ${log.target_clinic_name}` : ''}
              </p>
              {parts.length > 0 && (
                <p className="text-xs text-muted-foreground/90">{parts.join(' · ')}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
