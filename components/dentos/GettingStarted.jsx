'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, CheckCircle2, LayoutGrid, Users, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRole } from '@/components/dentos/RoleContext'

const STEPS = [
  { id: 'patient', label: 'Add your first patient', href: '/patients', icon: Users },
  { id: 'appointment', label: 'Book an appointment', href: '/appointments', icon: Calendar },
  { id: 'workspace', label: 'Customize your workspace', href: '/settings/workspace', icon: LayoutGrid },
]

const DISMISS_KEY_PREFIX = 'dentos_getting_started_dismissed'
const NEW_CLINIC_DAYS = 7

function dismissKey(clinicId) {
  return clinicId ? `${DISMISS_KEY_PREFIX}:${clinicId}` : DISMISS_KEY_PREFIX
}

export function isNewClinicWindow(clinic, now = Date.now()) {
  const raw = clinic?.created_at
  if (!raw) return false
  const created = new Date(raw).getTime()
  if (Number.isNaN(created)) return false
  return now - created < NEW_CLINIC_DAYS * 24 * 60 * 60 * 1000
}

function hasPatientActivity(stats) {
  if (!stats) return false
  if ((stats.patients_seen_today || 0) > 0) return true
  if ((stats.today_queue || []).length > 0) return true
  if ((stats.followups || []).length > 0) return true
  if ((stats.followups_due_count || 0) > 0) return true
  return false
}

function hasAppointmentActivity(stats) {
  return (stats?.today_queue?.length ?? 0) > 0
}

export function GettingStarted({ stats, className }) {
  const { me } = useRole()
  const clinicId = me?.clinic?.id
  const [dismissed, setDismissed] = useState(null)

  useEffect(() => {
    try {
      const scoped = localStorage.getItem(dismissKey(clinicId)) === 'true'
      const legacy = localStorage.getItem(DISMISS_KEY_PREFIX) === 'true'
      setDismissed(scoped || legacy)
    } catch {
      setDismissed(false)
    }
  }, [clinicId])

  // Established clinics: hide immediately (do not wait for stats — that was the layout jump).
  if (!isNewClinicWindow(me?.clinic)) return null
  if (dismissed !== false) return null
  if (!stats) return null

  const hasPatients = hasPatientActivity(stats)
  const hasAppointments = hasAppointmentActivity(stats)
  if (hasPatients && hasAppointments) return null

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(clinicId), 'true')
    } catch { /* private mode */ }
    setDismissed(true)
  }

  return (
    <Card className={cn('border-primary/30 bg-gradient-to-br from-teal-50/80 to-background dark:from-teal-950/20', className)}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Getting started with DentOS</CardTitle>
            <CardDescription className="mt-0.5 text-sm">
              Complete these steps to set up your clinic for daily use.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={dismiss} aria-label="Dismiss getting started">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3 px-4 pb-4">
        {STEPS.map(step => {
          const done = step.id === 'patient' ? hasPatients : step.id === 'appointment' ? hasAppointments : false
          const Icon = step.icon
          return (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-muted/50 min-h-[40px]',
                done ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' : 'border-border'
              )}
            >
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" aria-hidden />
              ) : (
                <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden />
              )}
              <span className="text-sm font-medium">{step.label}</span>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default GettingStarted
