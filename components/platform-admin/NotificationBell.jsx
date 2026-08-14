'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

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

const TYPE_TONES = {
  payment_failed: 'text-red-600 dark:text-red-400',
  clinic_blocked: 'text-red-600 dark:text-red-400',
  emergency_lock: 'text-red-600 dark:text-red-400',
  grace_started: 'text-amber-600 dark:text-amber-400',
  grace_expires_tomorrow: 'text-amber-600 dark:text-amber-400',
  trial_expires_in_3_days: 'text-blue-600 dark:text-blue-400',
  payment_recovered: 'text-green-600 dark:text-green-400',
  webhook_failed: 'text-orange-600 dark:text-orange-400',
  cron_failed: 'text-orange-600 dark:text-orange-400',
}

function fmtAgo(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const intervalRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/platform-admin/notifications?status=all&limit=20')
      if (!r.ok) return
      const d = await r.json()
      setNotifications(d.notifications || [])
      setUnreadCount(d.unread_count || 0)
    } catch {
      // Non-fatal
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 30000)
    return () => clearInterval(intervalRef.current)
  }, [load])

  const markStatus = async (id, status) => {
    try {
      await fetch(`/api/platform-admin/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await load()
    } catch {
      // Non-fatal
    }
  }

  const unread = notifications.filter(n => !n.read && !n.dismissed)
  const rest = notifications.filter(n => n.read && !n.resolved && !n.dismissed).slice(0, 5)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold text-foreground">Notifications</p>
          <Link
            href="/platform-admin/notifications"
            className="text-xs text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            View all
          </Link>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {unread.length === 0 && rest.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">All caught up</p>
            </div>
          ) : (
            <>
              {unread.map(n => (
                <div key={n.id} className="flex items-start gap-3 border-b border-border bg-accent/30 px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold ${TYPE_TONES[n.type] || 'text-foreground'}`}>
                      {TYPE_LABELS[n.type] || n.type}
                    </p>
                    <p className="text-sm text-foreground">{n.clinic_name}</p>
                    <p className="text-xs text-muted-foreground">{fmtAgo(n.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => markStatus(n.id, 'read')}
                    >
                      Mark read
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => markStatus(n.id, 'dismissed')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {rest.map(n => (
                <div key={n.id} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 opacity-60">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {TYPE_LABELS[n.type] || n.type}
                    </p>
                    <p className="text-sm text-foreground">{n.clinic_name}</p>
                    <p className="text-xs text-muted-foreground">{fmtAgo(n.created_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => markStatus(n.id, 'resolved')}
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
