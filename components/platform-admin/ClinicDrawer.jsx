'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  Ban,
  CreditCard,
  ExternalLink,
  Loader2,
  LogIn,
  Power,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConsoleStatusBadge, InactivityBadge, PlanBadge } from '@/components/platform-admin/Badges'
import { DetailCard } from '@/components/platform-admin/StatCard'
import { fmtDate, fmtDateTime, fmtMoney, fmtRelative, formatBytes, initials } from '@/components/platform-admin/format'
import { PLAN_OPTIONS } from '@/lib/platform-admin-console-core'
import { cn } from '@/lib/utils'

const FeaturesSection = dynamic(() => import('@/components/platform-admin/sections/FeaturesSection'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 rounded-xl" />,
})
const TimelineSection = dynamic(() => import('@/components/platform-admin/sections/TimelineSection'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 rounded-xl" />,
})
const PaymentsSection = dynamic(() => import('@/components/platform-admin/sections/PaymentsSection'), {
  ssr: false,
  loading: () => <Skeleton className="h-48 rounded-xl" />,
})

function DeactivateDialog({ clinic, open, onOpenChange, onDone }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!reason.trim()) {
      toast.error('A reason is required')
      return
    }
    setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false, deactivation_reason: reason.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(d.error || 'Failed to deactivate')
        return
      }
      toast.success(`${clinic.name} deactivated`)
      onDone(d.clinic || { is_active: false, deactivation_reason: reason.trim(), console_status: 'inactive' })
      onOpenChange(false)
      setReason('')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate {clinic?.name}</DialogTitle>
          <DialogDescription>
            Staff will not be able to log in and API access will be blocked. All clinic data is preserved.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="deactivate-reason">Reason *</Label>
          <Textarea id="deactivate-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={loading || !reason.trim()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
            Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ClinicDrawer({ clinicId, open, onOpenChange, onClinicChange, onRequestDelete }) {
  const [clinic, setClinic] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [impOpen, setImpOpen] = useState(false)
  const [impReason, setImpReason] = useState('')
  const [impLoading, setImpLoading] = useState(false)
  const [plan, setPlan] = useState('')
  const [savingPlan, setSavingPlan] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const load = useCallback(async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinicId}`)
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || 'Failed to load clinic')
        return
      }
      setClinic(d.clinic)
      setPlan(d.clinic?.plan_type || 'free')
      setNotes(d.clinic?.platform_notes || '')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    if (open && clinicId) {
      setTab('overview')
      load()
    }
  }, [open, clinicId, load])

  const patchClinic = (patch) => {
    setClinic(c => (c ? { ...c, ...patch } : c))
    onClinicChange?.(clinicId, patch)
  }

  const activate = async () => {
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(d.error || 'Failed to activate')
        return
      }
      toast.success(`${clinic.name} activated`)
      const next = d.clinic || { is_active: true, console_status: 'active' }
      patchClinic(next)
      if (d.clinic) setClinic(d.clinic)
    } catch {
      toast.error('Network error')
    }
  }

  const subscriptionAction = async (action, extra = {}) => {
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinicId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(d.error || 'Action failed')
        return
      }
      toast.success('Subscription updated')
      load()
    } catch {
      toast.error('Network error')
    }
  }

  const savePlan = async () => {
    setSavingPlan(true)
    await subscriptionAction('change_plan', { plan_type: plan })
    setSavingPlan(false)
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_notes: notes }),
      })
      if (!r.ok) {
        toast.error('Failed to save notes')
        return
      }
      toast.success('Notes saved')
      patchClinic({ platform_notes: notes })
    } catch {
      toast.error('Network error')
    } finally {
      setSavingNotes(false)
    }
  }

  const impersonate = async () => {
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'fixed inset-y-0 right-0 left-auto flex h-dvh w-full max-w-2xl translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-y-0 border-r-0 p-0 shadow-2xl sm:rounded-none',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100'
          )}
        >
          {loading || !clinic ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : (
            <>
              <div className="border-b border-border px-6 py-5">
                <div className="flex items-start gap-3 pr-8">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                    {initials(clinic.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="truncate text-lg">{clinic.name}</DialogTitle>
                    <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
                      <ConsoleStatusBadge status={clinic.console_status} />
                      <PlanBadge plan={clinic.plan_type} />
                      <InactivityBadge bucket={clinic.inactivity_bucket} label={clinic.inactivity_label} />
                    </DialogDescription>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {clinic.owner_name || 'No owner'} · {clinic.owner_email || 'No email'} · {clinic.phone || 'No phone'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {clinic.console_status === 'inactive' ? (
                    <Button size="sm" onClick={activate}><Power className="mr-1.5 h-3.5 w-3.5" />Activate</Button>
                  ) : clinic.console_status !== 'deleted' ? (
                    <Button size="sm" variant="outline" onClick={() => setDeactivateOpen(true)}>
                      <Ban className="mr-1.5 h-3.5 w-3.5" />Deactivate
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => setImpOpen(true)} disabled={clinic.console_status === 'deleted'}>
                    <LogIn className="mr-1.5 h-3.5 w-3.5" />Login as clinic
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/platform-admin/clinics/${clinic.id}`}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Full control center
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={clinic.is_active !== false || !!clinic.deleted_at}
                    onClick={() => onRequestDelete?.(clinic)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
                  </Button>
                </div>
                {clinic.deactivation_reason && clinic.console_status === 'inactive' && (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Deactivated{clinic.deactivated_by ? ` by ${clinic.deactivated_by}` : ''}: {clinic.deactivation_reason}
                  </p>
                )}
              </div>

              <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-border px-6">
                  <TabsList className="h-11 w-full justify-start gap-1 bg-transparent p-0">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="subscription">Subscription</TabsTrigger>
                    <TabsTrigger value="features">Features</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="lead">Lead</TabsTrigger>
                  </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <TabsContent value="overview" className="mt-0 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailCard label="Owner" value={clinic.owner_name || '—'} hint={clinic.owner_email} />
                      <DetailCard label="Phone" value={clinic.phone || '—'} />
                      <DetailCard label="Created" value={fmtDate(clinic.created_at)} />
                      <DetailCard label="Last active" value={fmtRelative(clinic.last_activity)} hint={fmtDateTime(clinic.last_activity)} />
                      <DetailCard label="Doctors" value={clinic.doctor_count} />
                      <DetailCard label="Receptionists" value={clinic.receptionist_count} />
                      <DetailCard label="Patients" value={clinic.patient_count} />
                      <DetailCard label="Appointments" value={clinic.appointment_count} />
                      <DetailCard label="Revenue" value={fmtMoney(clinic.revenue_total)} hint={`${clinic.payment_count || 0} payments`} />
                      <DetailCard
                        label="Storage"
                        value={clinic.storage_bytes ? formatBytes(clinic.storage_bytes) : `${clinic.storage_files || clinic.document_count || 0} files`}
                      />
                      <DetailCard label="Workflow" value={clinic.workflow_mode || 'default'} />
                      <DetailCard label="Version" value={clinic.version} />
                    </div>
                  </TabsContent>

                  <TabsContent value="subscription" className="mt-0 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailCard label="Plan" value={<PlanBadge plan={clinic.plan_type} />} />
                      <DetailCard label="Billing" value={clinic.billing_status || '—'} />
                      <DetailCard label="Trial ends" value={fmtDate(clinic.trial_ends_at)} />
                      <DetailCard label="Period end" value={fmtDate(clinic.current_period_end)} />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="grid gap-1">
                        <Label>Change plan</Label>
                        <Select value={plan} onValueChange={setPlan}>
                          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" onClick={savePlan} disabled={savingPlan}>
                        {savingPlan ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-2 h-3.5 w-3.5" />}
                        Save plan
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => subscriptionAction('extend_trial', { days: 14 })}>Extend trial +14d</Button>
                      <Button size="sm" variant="outline" onClick={() => subscriptionAction('pause')}>Pause</Button>
                      <Button size="sm" variant="outline" onClick={() => subscriptionAction('resume')}>Resume</Button>
                      <Button size="sm" variant="outline" onClick={() => subscriptionAction('mark_paid', { amount: 0, method: 'manual' })}>Mark as paid</Button>
                    </div>
                    <Separator />
                    <PaymentsSection clinic={clinic} onClinicUpdate={patchClinic} />
                  </TabsContent>

                  <TabsContent value="features" className="mt-0">
                    <FeaturesSection clinic={clinic} onClinicUpdate={patchClinic} />
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0">
                    <TimelineSection clinic={clinic} />
                  </TabsContent>

                  <TabsContent value="lead" className="mt-0 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailCard label="Last login" value={fmtRelative(clinic.last_staff_login)} hint={fmtDateTime(clinic.last_staff_login)} />
                      <DetailCard label="Last activity" value={fmtRelative(clinic.last_activity)} />
                      <DetailCard label="Days inactive" value={clinic.days_since_last_activity ?? '—'} />
                      <DetailCard label="Total sessions" value={clinic.session_count} />
                      <DetailCard label="Onboarding" value={clinic.onboarding_complete ? 'Complete' : 'Incomplete'} />
                      <DetailCard label="Trial expiry" value={fmtDate(clinic.trial_ends_at)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="lead-notes" className="flex items-center gap-2">
                        <StickyNote className="h-3.5 w-3.5" /> Notes
                      </Label>
                      <Textarea id="lead-notes" rows={5} value={notes} onChange={e => setNotes(e.target.value)} />
                      <Button size="sm" className="justify-self-start" onClick={saveNotes} disabled={savingNotes}>
                        {savingNotes ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                        Save notes
                      </Button>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {clinic && (
        <DeactivateDialog
          clinic={clinic}
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          onDone={(patch) => {
            patchClinic(patch)
            if (patch.id) setClinic(c => ({ ...c, ...patch }))
            load()
          }}
        />
      )}

      <Dialog open={impOpen} onOpenChange={setImpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login as {clinic?.name}</DialogTitle>
            <DialogDescription>
              Opens a new tab impersonating this clinic. Every action is audited.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="imp-reason">Reason *</Label>
            <Textarea id="imp-reason" rows={3} value={impReason} onChange={e => setImpReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpOpen(false)}>Cancel</Button>
            <Button onClick={impersonate} disabled={impLoading || !impReason.trim()}>
              {impLoading ? 'Opening…' : 'Open clinic session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
