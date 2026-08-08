'use client'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from 'lucide-react'
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
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function MaintenancePage() {
  const [maintenance, setMaintenance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  const [form, setForm] = useState({
    message: '',
    estimated_end: '',
    scope: 'platform',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/platform-admin/maintenance')
      const d = await r.json()
      setMaintenance(d.maintenance || { enabled: false })
      if (d.maintenance?.enabled) {
        setForm({
          message: d.maintenance.message || '',
          estimated_end: d.maintenance.estimated_end
            ? new Date(d.maintenance.estimated_end).toISOString().slice(0, 16)
            : '',
          scope: d.maintenance.scope || 'platform',
        })
      }
    } catch {
      toast.error('Failed to load maintenance status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const enable = async () => {
    if (!form.message.trim()) { toast.error('Message is required'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/platform-admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed'); return }
      toast.success('Maintenance mode enabled')
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const disable = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/platform-admin/maintenance', { method: 'DELETE' })
      if (!r.ok) { toast.error('Failed'); return }
      toast.success('Maintenance mode disabled')
      setForm({ message: '', estimated_end: '', scope: 'platform' })
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
      setDisableOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  const isActive = maintenance?.enabled === true

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Wrench className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Maintenance Mode</h1>
          <p className="text-sm text-muted-foreground">
            Control platform-wide maintenance windows. Platform admins always bypass maintenance.
          </p>
        </div>
      </div>

      {/* Status card */}
      <Card className={isActive ? 'border-amber-500/50 bg-amber-500/5' : 'border-green-500/30 bg-green-500/5'}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base">
            {isActive ? (
              <><AlertTriangle className="h-5 w-5 text-amber-500" /> Maintenance Active</>
            ) : (
              <><CheckCircle2 className="h-5 w-5 text-green-500" /> Platform Normal</>
            )}
            <Badge variant={isActive ? 'outline' : 'secondary'} className={isActive ? 'border-amber-500 text-amber-600' : ''}>
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
          </CardTitle>
        </CardHeader>
        {isActive && (
          <CardContent className="space-y-2">
            <p className="text-sm text-foreground">{maintenance.message}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Scope: <strong>{maintenance.scope}</strong></span>
              {maintenance.estimated_end && (
                <span>Estimated end: <strong>{fmtDate(maintenance.estimated_end)}</strong></span>
              )}
              <span>Enabled: <strong>{fmtDate(maintenance.enabled_at)}</strong></span>
              <span>By: <strong>{maintenance.enabled_by_email}</strong></span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => setDisableOpen(true)}
              disabled={saving}
            >
              Disable Maintenance
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Enable form */}
      {!isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enable Maintenance Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Maintenance Message *</Label>
              <Textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="We are performing scheduled maintenance and will be back shortly…"
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Scope</Label>
                <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">Entire Platform</SelectItem>
                    <SelectItem value="selected">Selected Clinics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estimated End Time</Label>
                <Input
                  type="datetime-local"
                  value={form.estimated_end}
                  onChange={e => setForm(f => ({ ...f, estimated_end: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Enabling maintenance mode will show a maintenance screen to all clinic users (scope: {form.scope}).
                Platform admins are never affected. This action will be audited.
              </p>
            </div>

            <Button onClick={enable} disabled={saving || !form.message.trim()} className="gap-2">
              <Wrench className="h-4 w-4" />
              {saving ? 'Enabling…' : 'Enable Maintenance Mode'}
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Maintenance Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore normal access for all clinic users immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={disable} disabled={saving}>
              {saving ? 'Disabling…' : 'Disable Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
