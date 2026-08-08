'use client'
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, LogIn, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AccessBadge, BillingBadge, PlanBadge, StatusBadge } from '@/components/platform-admin/Badges'
import { CLINIC_SECTIONS, ClinicSectionNav } from '@/components/platform-admin/ClinicSectionNav'
import { initials } from '@/components/platform-admin/format'

const SectionFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-48 rounded-lg" />
    <Skeleton className="h-32 rounded-xl" />
    <Skeleton className="h-64 rounded-xl" />
  </div>
)

const lazySection = loader => dynamic(loader, { loading: SectionFallback, ssr: false })

const SECTION_COMPONENTS = {
  overview: lazySection(() => import('@/components/platform-admin/sections/OverviewSection')),
  subscription: lazySection(() => import('@/components/platform-admin/sections/SubscriptionSection')),
  payments: lazySection(() => import('@/components/platform-admin/sections/PaymentsSection')),
  usage: lazySection(() => import('@/components/platform-admin/sections/UsageSection')),
  team: lazySection(() => import('@/components/platform-admin/sections/TeamSection')),
  features: lazySection(() => import('@/components/platform-admin/sections/FeaturesSection')),
  security: lazySection(() => import('@/components/platform-admin/sections/SecuritySection')),
  audit: lazySection(() => import('@/components/platform-admin/sections/AuditSection')),
  support: lazySection(() => import('@/components/platform-admin/sections/SupportSection')),
  timeline: lazySection(() => import('@/components/platform-admin/sections/TimelineSection')),
  diagnostics: lazySection(() => import('@/components/platform-admin/sections/DiagnosticsSection')),
}

export default function ClinicControlCenterPage({ params }) {
  const clinicId = params.id
  const [clinic, setClinic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [missing, setMissing] = useState(false)
  const [section, setSection] = useState('overview')

  // Impersonation dialog
  const [impOpen, setImpOpen] = useState(false)
  const [impReason, setImpReason] = useState('')
  const [impLoading, setImpLoading] = useState(false)

  const loadClinic = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch('/api/platform-admin/clinics')
      if (!r.ok) {
        toast.error('Failed to load clinic')
        return
      }
      const d = await r.json()
      const found = (d.clinics || []).find(c => c.id === clinicId)
      if (!found) {
        setMissing(true)
        return
      }
      setClinic(found)
      setMissing(false)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [clinicId])

  useEffect(() => { loadClinic() }, [loadClinic])

  const onClinicUpdate = useCallback(patch => {
    setClinic(c => (c ? { ...c, ...patch } : c))
  }, [])

  const handleImpersonate = async () => {
    if (!impReason.trim()) {
      toast.error('A reason is required')
      return
    }
    setImpLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinicId}/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: impReason }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || 'Impersonation failed')
        return
      }
      setImpOpen(false)
      setImpReason('')
      window.open(`/auth/impersonate?token=${encodeURIComponent(d.token)}`, '_blank')
    } catch {
      toast.error('Network error')
    } finally {
      setImpLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <Skeleton className="hidden h-80 rounded-xl lg:block" />
          <SectionFallback />
        </div>
      </div>
    )
  }

  if (missing || !clinic) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
        <p className="text-lg font-medium text-foreground">Clinic not found</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been removed from the platform.</p>
        <Button asChild variant="outline" size="sm" className="mt-6">
          <Link href="/platform-admin">Back to control center</Link>
        </Button>
      </div>
    )
  }

  const ActiveSection = SECTION_COMPONENTS[section] || SECTION_COMPONENTS.overview
  const activeLabel = CLINIC_SECTIONS.find(s => s.id === section)?.label || 'Overview'

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/platform-admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All clinics
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
              {initials(clinic.name)}
            </span>
            <div className="min-w-0 space-y-1.5">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{clinic.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge active={clinic.is_active} />
                <AccessBadge status={clinic.subscription_status} />
                <PlanBadge plan={clinic.plan_type} />
                <BillingBadge status={clinic.billing_status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImpOpen(true)}
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              Login as Clinic
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadClinic({ silent: true })}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ClinicSectionNav active={section} onChange={setSection} />
        <section aria-label={activeLabel} className="min-w-0">
          <ActiveSection clinic={clinic} onClinicUpdate={onClinicUpdate} />
        </section>
      </div>

      <Dialog open={impOpen} onOpenChange={setImpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login as {clinic.name}</DialogTitle>
            <DialogDescription>
              You will open a new tab impersonating this clinic. Every action you take will be
              logged with your identity. The clinic password is never accessed or changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="imp-reason">Reason for impersonation *</Label>
            <Textarea
              id="imp-reason"
              placeholder="e.g. Investigating billing issue reported by clinic owner"
              value={impReason}
              onChange={e => setImpReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpOpen(false)} disabled={impLoading}>
              Cancel
            </Button>
            <Button onClick={handleImpersonate} disabled={impLoading || !impReason.trim()}>
              {impLoading ? 'Opening…' : 'Open Clinic Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
