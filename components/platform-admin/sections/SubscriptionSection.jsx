'use client'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Lock, LockOpen, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AccessBadge, BillingBadge, PlanBadge, ToneBadge } from '@/components/platform-admin/Badges'
import { AuditTimeline } from '@/components/platform-admin/AuditTimeline'
import { DetailCard } from '@/components/platform-admin/StatCard'
import { SectionHeading } from '@/components/platform-admin/Placeholder'
import {
  LIFECYCLE_STATUS_LABELS,
  LIFECYCLE_STATUS_TONES,
  PLATFORM_STATUS_OPTIONS,
  SUBSCRIPTION_TIMELINE_ACTIONS,
  fmtDate,
  fmtDateTime,
} from '@/components/platform-admin/format'

// ─── Lifecycle actions ────────────────────────────────────────────────────────
const LIFECYCLE_GROUPS = [
  {
    title: 'Access',
    items: [
      { status: 'trial', destructive: false, description: 'Set billing to trial; open access.' },
      { status: 'active', destructive: false, description: 'Set billing to active; open access.' },
      { status: 'grace', destructive: false, description: 'Set billing to halted; keep access open.' },
      { status: 'comped', destructive: false, description: 'Force platform override to comped.' },
    ],
  },
  {
    title: 'Restrict',
    items: [
      { status: 'paused', destructive: true, description: 'Block clinic access temporarily.' },
      { status: 'blocked', destructive: true, description: 'Block clinic access.' },
      { status: 'cancelled', destructive: true, description: 'Mark subscription as cancelled.' },
      { status: 'locked', destructive: true, description: 'Lock clinic with platform override.' },
    ],
  },
]

function LifecycleButton({ status, destructive, description, onClick, loading }) {
  const label = LIFECYCLE_STATUS_LABELS[status] || status
  const tone = LIFECYCLE_STATUS_TONES[status] || 'slate'

  if (destructive) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading} className="justify-start gap-2 text-left">
            <ToneBadge tone={tone} className="h-4 px-1.5 text-[10px]">{label}</ToneBadge>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set lifecycle status to &ldquo;{label}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onClick(status)}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm — set to {label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <Button variant="outline" size="sm" disabled={loading} onClick={() => onClick(status)} className="gap-2">
      <ToneBadge tone={tone} className="h-4 px-1.5 text-[10px]">{label}</ToneBadge>
    </Button>
  )
}

// ─── Emergency lock dialog ────────────────────────────────────────────────────
function EmergencyLockDialog({ clinicName, onConfirm, loading }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const submit = () => {
    if (!reason.trim()) {
      toast.error('A reason is required for emergency lock')
      return
    }
    onConfirm(reason.trim())
    setOpen(false)
    setReason('')
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="gap-2"
      >
        <Lock className="h-4 w-4" />
        Emergency lock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Emergency lock — {clinicName}
            </DialogTitle>
            <DialogDescription>
              This immediately blocks all clinic staff from signing in. A reason is required and will be
              permanently recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="lock-reason">Reason *</Label>
            <Textarea
              id="lock-reason"
              rows={3}
              placeholder="e.g. Reported breach, pending investigation"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setReason('') }}>Cancel</Button>
            <Button variant="destructive" onClick={submit} disabled={!reason.trim() || loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Lock clinic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Trial management ─────────────────────────────────────────────────────────
function TrialManagement({ clinic, onClinicUpdate }) {
  const [dateValue, setDateValue] = useState(
    clinic.trial_ends_at ? new Date(clinic.trial_ends_at).toISOString().slice(0, 10) : ''
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDateValue(clinic.trial_ends_at ? new Date(clinic.trial_ends_at).toISOString().slice(0, 10) : '')
  }, [clinic.trial_ends_at])

  const adjustDays = days => {
    const base = clinic.trial_ends_at ? new Date(clinic.trial_ends_at) : new Date()
    base.setDate(base.getDate() + days)
    setDateValue(base.toISOString().slice(0, 10))
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trial_ends_at: dateValue || null }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error || 'Failed to update trial')
        return
      }
      const updated = await r.json()
      toast.success('Trial end date updated')
      onClinicUpdate({ trial_ends_at: updated.trial_ends_at })
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trial management</CardTitle>
        <CardDescription>
          Directly controls <code className="rounded bg-muted px-1 text-[11px]">clinics.trial_ends_at</code>.
          The daily cron uses this field to decide whether to block the clinic.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="trial-date">Trial end date</Label>
            <Input
              id="trial-date"
              type="date"
              value={dateValue}
              onChange={e => setDateValue(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save date
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustDays(7)}
            disabled={saving}
            title="Extend by 7 days"
          >
            +7 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustDays(14)}
            disabled={saving}
            title="Extend by 14 days"
          >
            +14 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustDays(30)}
            disabled={saving}
            title="Extend by 30 days"
          >
            +30 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustDays(-7)}
            disabled={saving}
            title="Reduce by 7 days"
            className="text-muted-foreground"
          >
            −7 days
          </Button>
        </div>
        {clinic.trial_ends_at && (
          <p className="text-xs text-muted-foreground">
            Current trial end: <span className="font-medium text-foreground">{fmtDate(clinic.trial_ends_at)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Subscription timeline ────────────────────────────────────────────────────
function SubscriptionTimeline({ clinicId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/platform-admin/audit-log?limit=200')
      if (!r.ok) return
      const d = await r.json()
      const filtered = (d.logs || []).filter(
        l => l.target_clinic_id === clinicId && SUBSCRIPTION_TIMELINE_ACTIONS.has(l.action)
      )
      setLogs(filtered)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [clinicId])

  useEffect(() => { load() }, [load])

  return loading ? (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
    </div>
  ) : (
    <AuditTimeline
      logs={logs}
      showClinic={false}
      emptyLabel="No subscription events recorded yet"
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SubscriptionSection({ clinic, onClinicUpdate }) {
  const [override, setOverride] = useState(clinic.platform_status || 'none')
  const [savingOverride, setSavingOverride] = useState(false)
  const [savingAccess, setSavingAccess] = useState(false)
  const [savingEnforcement, setSavingEnforcement] = useState(false)
  const [savingLifecycle, setSavingLifecycle] = useState(false)
  const [savingEmergency, setSavingEmergency] = useState(false)

  useEffect(() => {
    setOverride(clinic.platform_status || 'none')
  }, [clinic.platform_status])

  const blocked = clinic.subscription_status === 'blocked'
  const emergencyLocked = blocked && !!clinic.emergency_locked_at

  // ── Save platform override ─────────────────────────────────────────────────
  const saveOverride = async () => {
    const platform_status = override === 'none' ? null : override
    setSavingOverride(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_status }),
      })
      if (!r.ok) {
        toast.error('Failed to update override')
        return
      }
      toast.success('Platform override saved')
      onClinicUpdate({ platform_status })
    } catch {
      toast.error('Network error')
    } finally {
      setSavingOverride(false)
    }
  }

  // ── Access toggle ──────────────────────────────────────────────────────────
  const setAccess = async nextBlocked => {
    const subscription_status = nextBlocked ? 'blocked' : 'active'
    setSavingAccess(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_status }),
      })
      if (!r.ok) {
        toast.error('Failed to update access')
        return
      }
      const updated = await r.json().catch(() => ({}))
      toast.success(
        nextBlocked
          ? `${clinic.name} access paused`
          : `${clinic.name} access restored`
      )
      onClinicUpdate({
        subscription_status,
        trial_auto_enforcement: updated.trial_auto_enforcement ?? (nextBlocked ? 'auto' : 'paused'),
      })
    } catch {
      toast.error('Network error')
    } finally {
      setSavingAccess(false)
    }
  }

  // ── Trial auto-enforcement ─────────────────────────────────────────────────
  const resumeTrialAutoBlock = async () => {
    setSavingEnforcement(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trial_auto_enforcement: 'auto' }),
      })
      if (!r.ok) {
        toast.error('Failed to update auto-enforcement')
        return
      }
      const updated = await r.json()
      toast.success('Trial auto-block re-enabled')
      onClinicUpdate({ trial_auto_enforcement: updated.trial_auto_enforcement || 'auto' })
    } catch {
      toast.error('Network error')
    } finally {
      setSavingEnforcement(false)
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  const applyLifecycle = async status => {
    setSavingLifecycle(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error || 'Failed to apply lifecycle change')
        return
      }
      const updated = await r.json()
      toast.success(`Lifecycle set to "${LIFECYCLE_STATUS_LABELS[status]}"`)
      onClinicUpdate({
        subscription_status: updated.subscription_status,
        billing_status: updated.billing_status,
        platform_status: updated.platform_status,
        trial_auto_enforcement: updated.trial_auto_enforcement,
      })
    } catch {
      toast.error('Network error')
    } finally {
      setSavingLifecycle(false)
    }
  }

  // ── Emergency lock ─────────────────────────────────────────────────────────
  const applyEmergencyLock = async reason => {
    setSavingEmergency(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emergency_lock: true, emergency_lock_reason: reason }),
      })
      if (!r.ok) {
        toast.error('Failed to apply emergency lock')
        return
      }
      const updated = await r.json()
      toast.success('Emergency lock applied')
      onClinicUpdate({
        subscription_status: 'blocked',
        trial_auto_enforcement: 'auto',
        emergency_locked_at: updated.emergency_locked_at,
        emergency_locked_by: updated.emergency_locked_by,
        emergency_locked_reason: updated.emergency_locked_reason,
      })
    } catch {
      toast.error('Network error')
    } finally {
      setSavingEmergency(false)
    }
  }

  const applyEmergencyUnlock = async () => {
    setSavingEmergency(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emergency_lock: false }),
      })
      if (!r.ok) {
        toast.error('Failed to remove emergency lock')
        return
      }
      const updated = await r.json()
      toast.success('Emergency lock removed')
      onClinicUpdate({
        subscription_status: updated.subscription_status,
        trial_auto_enforcement: updated.trial_auto_enforcement,
        emergency_locked_at: null,
        emergency_locked_by: null,
        emergency_locked_reason: null,
      })
    } catch {
      toast.error('Network error')
    } finally {
      setSavingEmergency(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Subscription"
        description="Trial dates, lifecycle status, platform overrides and clinic access."
      />

      {/* Emergency lock banner */}
      {emergencyLocked && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">Emergency lock active</p>
              {clinic.emergency_locked_reason && (
                <p className="text-sm text-red-800 dark:text-red-200">{clinic.emergency_locked_reason}</p>
              )}
              <p className="text-xs text-red-700 dark:text-red-300">
                Locked {fmtDateTime(clinic.emergency_locked_at)}
                {clinic.emergency_locked_by ? ` by ${clinic.emergency_locked_by}` : ''}
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0" disabled={savingEmergency}>
                <LockOpen className="mr-2 h-4 w-4" />
                Remove lock
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove emergency lock?</AlertDialogTitle>
                <AlertDialogDescription>
                  Clinic access will be restored. Trial auto-block will be paused until re-enabled.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={applyEmergencyUnlock}>
                  Remove lock
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Trial auto-block paused banner */}
      {clinic.trial_auto_enforcement === 'paused' && !blocked && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Trial auto-block is paused. The daily cron will not re-block this clinic until you re-enable enforcement.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={resumeTrialAutoBlock}
            disabled={savingEnforcement}
          >
            {savingEnforcement ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Re-enable auto-block
          </Button>
        </div>
      )}

      {/* Info grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DetailCard label="Current plan" value={<PlanBadge plan={clinic.plan_type} />} />
        <DetailCard label="Razorpay status" value={<BillingBadge status={clinic.billing_status} />} />
        <DetailCard label="Clinic access" value={<AccessBadge status={clinic.subscription_status} />} />
        <DetailCard
          label="Trial ends"
          value={clinic.trial_ends_at ? fmtDate(clinic.trial_ends_at) : '—'}
          hint={clinic.trial_ends_at ? `Raw: ${new Date(clinic.trial_ends_at).toISOString().slice(0, 10)}` : 'Not set'}
        />
        <DetailCard
          label="Current period end"
          value={clinic.current_period_end ? fmtDate(clinic.current_period_end) : '—'}
        />
        <DetailCard
          label="Grace period end"
          value={clinic.grace_period_end ? fmtDate(clinic.grace_period_end) : '—'}
          hint={
            clinic.days_remaining != null
              ? `${clinic.days_remaining} day${clinic.days_remaining === 1 ? '' : 's'} remaining`
              : undefined
          }
        />
        <DetailCard
          label="Subscription reason"
          value={clinic.subscription_reason
            ? clinic.subscription_reason.replace(/_/g, ' ')
            : '—'
          }
        />
        <DetailCard
          label="Subscription ID"
          value={clinic.subscription_id
            ? <span className="font-mono text-xs">{clinic.subscription_id}</span>
            : '—'
          }
        />
        <DetailCard
          label="Customer ID"
          value={clinic.customer_id
            ? <span className="font-mono text-xs">{clinic.customer_id}</span>
            : '—'
          }
        />
        <DetailCard
          label="Platform override"
          value={
            clinic.platform_status
              ? <span className="capitalize font-medium">{clinic.platform_status.replace('_', ' ')}</span>
              : 'None'
          }
        />
        <DetailCard
          label="Trial auto-enforcement"
          value={clinic.trial_auto_enforcement === 'paused' ? 'Paused' : 'Automatic'}
          hint={clinic.manual_access_granted_at
            ? `Manual access ${fmtDateTime(clinic.manual_access_granted_at)}`
            : undefined}
        />
        <DetailCard label="Payment method" value={clinic.payment_method || '—'} />
        {emergencyLocked && (
          <DetailCard
            label="Emergency lock"
            value={fmtDateTime(clinic.emergency_locked_at)}
            hint={clinic.emergency_locked_by || undefined}
          />
        )}
      </div>

      {/* Trial management */}
      <TrialManagement clinic={clinic} onClinicUpdate={onClinicUpdate} />

      {/* Lifecycle actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifecycle control</CardTitle>
          <CardDescription>
            Directly set the billing and access state. Destructive actions require confirmation.
            All changes are audited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {LIFECYCLE_GROUPS.map(group => (
            <div key={group.title} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map(item => (
                  <LifecycleButton
                    key={item.status}
                    {...item}
                    onClick={applyLifecycle}
                    loading={savingLifecycle}
                  />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Access toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access control</CardTitle>
          <CardDescription>Immediately pause or restore clinic access to DentOS.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="access-toggle" className="text-sm font-medium">Block clinic access</Label>
            <p className="text-sm text-muted-foreground">
              {blocked ? 'Staff cannot sign in to this clinic.' : 'Clinic staff can sign in normally.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savingAccess && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              id="access-toggle"
              checked={blocked}
              disabled={savingAccess}
              onCheckedChange={setAccess}
            />
          </div>
        </CardContent>
      </Card>

      {/* Platform override */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform override</CardTitle>
          <CardDescription>
            Override the Razorpay-derived status. Takes priority over all automatic rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid w-full gap-2 sm:max-w-xs">
            <Label htmlFor="platform-status">Override mode</Label>
            <Select value={override} onValueChange={setOverride}>
              <SelectTrigger id="platform-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={saveOverride}
            disabled={savingOverride || override === (clinic.platform_status || 'none')}
          >
            {savingOverride ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save override
          </Button>
        </CardContent>
      </Card>

      {/* Emergency lock */}
      {!emergencyLocked && (
        <Card className="border-red-200 dark:border-red-900/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-400">
              <ShieldAlert className="h-4 w-4" />
              Emergency lock
            </CardTitle>
            <CardDescription>
              Immediately blocks all staff from signing in. Requires a reason. Recorded permanently in the
              audit log. Use only in genuine security or operational emergencies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmergencyLockDialog
              clinicName={clinic.name}
              onConfirm={applyEmergencyLock}
              loading={savingEmergency}
            />
          </CardContent>
        </Card>
      )}

      {/* Subscription timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription timeline</CardTitle>
          <CardDescription>
            All subscription, trial, access and payment events for this clinic, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionTimeline clinicId={clinic.id} />
        </CardContent>
      </Card>
    </div>
  )
}
