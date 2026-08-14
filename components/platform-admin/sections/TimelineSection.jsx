'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Building2,
  CreditCard,
  HeadphonesIcon,
  RefreshCw,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionHeading } from '@/components/platform-admin/Placeholder'
import { fmtDateTime, fmtRelative } from '@/components/platform-admin/format'
import { toast } from 'sonner'

const TYPE_ICONS = {
  clinic: Building2,
  audit: Shield,
  payment: CreditCard,
  support: HeadphonesIcon,
  subscription: Activity,
}

const TYPE_COLORS = {
  clinic: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  audit: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  payment: 'bg-green-500/10 text-green-600 dark:text-green-400',
  support: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  subscription: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

const DESTRUCTIVE_EVENTS = new Set([
  'emergency_lock',
  'trial_expired_auto_blocked',
  'grace_expired_auto_blocked',
  'clinic_blocked',
  'security_force_logout',
  'security_login_disabled',
  'payment_failed_grace_started',
])

export default function TimelineSection({ clinic }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/timeline`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setEvents(d.events || [])
    } catch {
      toast.error('Failed to load timeline')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [clinic.id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeading
          title="Clinic Timeline"
          description="Complete chronological history of all events for this clinic."
        />
        <Button variant="outline" size="sm" onClick={() => load({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No timeline events yet</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <ol className="space-y-0">
            {events.map((ev, i) => {
              const Icon = TYPE_ICONS[ev.type] || Activity
              const colorClass = TYPE_COLORS[ev.type] || 'bg-slate-500/10 text-slate-600'
              const isDestructive = DESTRUCTIVE_EVENTS.has(ev.event)

              return (
                <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Icon bubble */}
                  <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background ${colorClass.split(' ')[0]}`}>
                    <Icon className={`h-4 w-4 ${colorClass.split(' ').slice(1).join(' ')}`} />
                  </span>

                  {/* Content */}
                  <div className="flex-1 pt-1.5 pb-2">
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-0.5">
                      <p className={`text-sm font-medium ${isDestructive ? 'text-destructive' : 'text-foreground'}`}>
                        {ev.title}
                      </p>
                      {ev.actor && (
                        <span className="text-xs text-muted-foreground">by {ev.actor}</span>
                      )}
                    </div>
                    {ev.detail && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{ev.detail}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground/70" title={fmtDateTime(ev.at)}>
                      {fmtRelative(ev.at)} · {fmtDateTime(ev.at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
