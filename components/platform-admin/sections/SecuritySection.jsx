'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldOff,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { SectionHeading } from '@/components/platform-admin/Placeholder'
import { AuditTimeline } from '@/components/platform-admin/AuditTimeline'
import { fmtDateTime, fmtRelative } from '@/components/platform-admin/format'

function ReasonDialog({ title, description, action, onConfirm, children }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    if (!reason.trim()) { toast.error('Reason is required'); return }
    setLoading(true)
    await onConfirm(reason)
    setLoading(false)
    setOpen(false)
    setReason('')
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason *</Label>
            <Input
              placeholder="Describe why you are performing this action"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={confirm} disabled={loading || !reason.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {action || 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function SecuritySection({ clinic }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/security`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setData(d)
    } catch {
      toast.error('Failed to load security data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [clinic.id])

  useEffect(() => { load() }, [load])

  const forceLogout = async (userId, reason) => {
    const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/security/force-logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, reason }),
    })
    if (!r.ok) { toast.error('Action failed'); return }
    toast.success('User logged out')
    await load({ silent: true })
  }

  const forceLogoutAll = async (reason) => {
    const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/security/force-logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!r.ok) { toast.error('Action failed'); return }
    toast.success('All users logged out')
    await load({ silent: true })
  }

  const toggleLogin = async (userId, enabled, reason) => {
    const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/security/login-access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, enabled, reason }),
    })
    if (!r.ok) { toast.error('Action failed'); return }
    toast.success(enabled ? 'Login enabled' : 'Login disabled')
    await load({ silent: true })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const staff = data?.staff || []
  const impHistory = data?.impersonation_history || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeading title="Security Center" description="Manage staff access and review security events." />
        <div className="flex items-center gap-2">
          <ReasonDialog
            title="Force logout all users"
            description="This will invalidate all active sessions for this clinic. Users will need to log in again."
            action="Force Logout All"
            onConfirm={forceLogoutAll}
          >
            <Button variant="outline" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout All
            </Button>
          </ReasonDialog>
          <Button variant="outline" size="sm" onClick={() => load({ silent: true })} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Staff table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Staff Members ({staff.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {staff.map(u => (
              <div key={u.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{u.full_name}</span>
                    <Badge variant="outline" className="text-xs">{u.role}</Badge>
                    {!u.is_active && <Badge variant="destructive" className="text-xs">Disabled</Badge>}
                    {u.failed_attempts > 0 && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                        {u.failed_attempts} failed logins
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {u.has_google ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3" />}
                      Google
                    </span>
                    <span className="flex items-center gap-1">
                      {u.has_2fa ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3" />}
                      2FA
                    </span>
                    {u.last_login_at && (
                      <span title={fmtDateTime(u.last_login_at)}>
                        Last login: {fmtRelative(u.last_login_at)}
                      </span>
                    )}
                    {u.force_logout_at && (
                      <span className="text-amber-600">
                        Force-logged out: {fmtRelative(u.force_logout_at)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <ReasonDialog
                    title={`Force logout ${u.full_name}`}
                    action="Force Logout"
                    onConfirm={reason => forceLogout(u.id, reason)}
                  >
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                      <LogOut className="h-3 w-3" />
                      Logout
                    </Button>
                  </ReasonDialog>
                  <ReasonDialog
                    title={u.is_active ? `Disable login for ${u.full_name}` : `Enable login for ${u.full_name}`}
                    action={u.is_active ? 'Disable Login' : 'Enable Login'}
                    onConfirm={reason => toggleLogin(u.id, !u.is_active, reason)}
                  >
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                      {u.is_active ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                      {u.is_active ? 'Disable' : 'Enable'}
                    </Button>
                  </ReasonDialog>
                </div>
              </div>
            ))}
            {staff.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No staff profiles found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Impersonation history */}
      {impHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Impersonation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline logs={impHistory} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
