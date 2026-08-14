'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, CheckCircle2, LayoutGrid, Users, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'patient', label: 'Add your first patient', href: '/patients', icon: Users },
  { id: 'appointment', label: 'Book an appointment', href: '/appointments', icon: Calendar },
  { id: 'workspace', label: 'Customize your workspace', href: '/settings/workspace', icon: LayoutGrid },
]

const DISMISS_KEY = 'dentos_getting_started_dismissed'

export function GettingStarted({ stats, className }) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
  }, [])

  if (dismissed) return null

  const hasPatients = (stats?.recent_patients?.length ?? 0) > 0 || (stats?.todays_patients ?? 0) > 0
  const hasAppointments = (stats?.today_queue?.length ?? 0) > 0
  if (hasPatients && hasAppointments) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
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
