'use client'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const TYPE_LABELS = {
  trial_expires_in_3_days: 'Trial Expiring',
  grace_started: 'Grace Started',
  grace_expires_tomorrow: 'Grace Expiring',
  clinic_blocked: 'Clinic Blocked',
  payment_recovered: 'Payment Recovered',
  payment_failed: 'Payment Failed',
  webhook_failed: 'Webhook Failed',
  cron_failed: 'Cron Failed',
  emergency_lock: 'Emergency Lock',
  storage_warning: 'Storage Warning',
  broadcast_sent: 'Broadcast Sent',
  maintenance_enabled: 'Maintenance Enabled',
}

const TYPE_VARIANT = {
  payment_failed: 'destructive',
  clinic_blocked: 'destructive',
  emergency_lock: 'destructive',
  grace_started: 'outline',
  grace_expires_tomorrow: 'outline',
  trial_expires_in_3_days: 'secondary',
  payment_recovered: 'secondary',
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function NotificationRow({ n, onAction }) {
  return (
    <div className={`flex items-start gap-4 rounded-lg border p-4 ${!n.read ? 'bg-accent/20 border-accent' : 'border-border'}`}>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TYPE_VARIANT[n.type] || 'outline'} className="text-xs">
            {TYPE_LABELS[n.type] || n.type}
          </Badge>
          {!n.read && <Badge variant="default" className="text-xs">Unread</Badge>}
          {n.resolved && <Badge variant="secondary" className="text-xs">Resolved</Badge>}
        </div>
        <p className="font-medium text-foreground">{n.clinic_name || '—'}</p>
        {n.meta && Object.keys(n.meta).length > 0 && (
          <p className="text-xs text-muted-foreground">
            {Object.entries(n.meta)
              .filter(([, v]) => v != null && v !== '')
              .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
              .join(' · ')}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{fmtDate(n.created_at)}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        {!n.read && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(n.id, 'read')}>
            Mark read
          </Button>
        )}
        {!n.resolved && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(n.id, 'resolved')}>
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Resolve
          </Button>
        )}
        {!n.dismissed && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onAction(n.id, 'dismissed')}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [all, setAll] = useState([])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch('/api/platform-admin/notifications?status=all&limit=200')
      if (!r.ok) throw new Error('Failed to load')
      const d = await r.json()
      setAll(d.notifications || [])
    } catch {
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onAction = async (id, status) => {
    try {
      const r = await fetch(`/api/platform-admin/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) throw new Error()
      await load({ silent: true })
    } catch {
      toast.error('Action failed')
    }
  }

  const unread = all.filter(n => !n.read && !n.dismissed)
  const resolved = all.filter(n => n.resolved)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notification Center</h1>
          <p className="text-sm text-muted-foreground">{unread.length} unread</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="unread">
        <TabsList>
          <TabsTrigger value="unread">
            Unread
            {unread.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{unread.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="mt-4 space-y-3">
          {unread.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <CheckCircle2 className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No unread notifications</p>
            </div>
          ) : (
            unread.map(n => <NotificationRow key={n.id} n={n} onAction={onAction} />)
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-3">
          {all.filter(n => !n.dismissed).map(n => <NotificationRow key={n.id} n={n} onAction={onAction} />)}
          {all.filter(n => !n.dismissed).length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No notifications</p>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4 space-y-3">
          {resolved.map(n => <NotificationRow key={n.id} n={n} onAction={onAction} />)}
          {resolved.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No resolved notifications</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
