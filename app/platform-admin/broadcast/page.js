'use client'
import { useCallback, useEffect, useState } from 'react'
import { Megaphone, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
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

const RECIPIENT_FILTERS = [
  { value: 'all', label: 'All Clinics' },
  { value: 'trial', label: 'Trial Clinics' },
  { value: 'grace', label: 'Grace Period Clinics' },
  { value: 'blocked', label: 'Blocked Clinics' },
  { value: 'active', label: 'Active Clinics' },
]

const CHANNELS = [
  { value: 'dashboard', label: 'Dashboard Notification' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const TEMPLATES = [
  { id: 'maintenance', label: 'Maintenance Notice', subject: 'Scheduled Maintenance', body: 'We will be performing scheduled maintenance on {date} from {time}. The platform will be unavailable during this window. We apologize for any inconvenience.' },
  { id: 'feature_release', label: 'Feature Release', subject: 'New Feature Available', body: 'We are excited to announce a new feature: {feature}. Log in to your dashboard to explore it.' },
  { id: 'payment_reminder', label: 'Payment Reminder', subject: 'Payment Reminder', body: 'This is a reminder that your subscription payment is due. Please update your payment method to avoid service interruption.' },
  { id: 'trial_reminder', label: 'Trial Ending', subject: 'Your Trial is Ending Soon', body: 'Your free trial ends in {days} days. Subscribe now to continue using DentOS without interruption.' },
  { id: 'custom', label: 'Custom Message', subject: '', body: '' },
]

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

const CHANNEL_VARIANT = {
  dashboard: 'secondary',
  email: 'outline',
  whatsapp: 'outline',
}

export default function BroadcastPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [form, setForm] = useState({
    recipients_filter: 'all',
    channel: 'dashboard',
    template: 'custom',
    subject: '',
    body: '',
  })

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/platform-admin/broadcast')
      if (!r.ok) throw new Error()
      const d = await r.json()
      setHistory(d.broadcasts || [])
    } catch {
      toast.error('Failed to load broadcast history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const applyTemplate = (id) => {
    const t = TEMPLATES.find(t => t.id === id)
    if (!t) return
    setForm(f => ({
      ...f,
      template: id,
      subject: t.subject || f.subject,
      body: t.body || '',
    }))
  }

  const send = async () => {
    if (!form.body.trim()) { toast.error('Message body is required'); return }
    setSending(true)
    try {
      const r = await fetch('/api/platform-admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed to send'); return }
      toast.success(`Broadcast sent to ${d.delivered_count} clinic${d.delivered_count !== 1 ? 's' : ''}`)
      setForm({ recipients_filter: 'all', channel: 'dashboard', template: 'custom', subject: '', body: '' })
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
      setConfirmOpen(false)
    }
  }

  const recipientLabel = RECIPIENT_FILTERS.find(r => r.value === form.recipients_filter)?.label || form.recipients_filter
  const channelLabel = CHANNELS.find(c => c.value === form.channel)?.label || form.channel

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Megaphone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Broadcast Center</h1>
          <p className="text-sm text-muted-foreground">Send messages to clinics. Every broadcast is permanently logged.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Compose */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compose Broadcast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Recipients</Label>
                <Select
                  value={form.recipients_filter}
                  onValueChange={v => setForm(f => ({ ...f, recipients_filter: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECIPIENT_FILTERS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select
                  value={form.channel}
                  onValueChange={v => setForm(f => ({ ...f, channel: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={form.template} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Subject line (optional for dashboard)"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Message *</Label>
              <Textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Message body…"
                rows={5}
              />
            </div>

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={sending || !form.body.trim()}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Send Broadcast
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{recipientLabel}</Badge>
              <Badge variant={CHANNEL_VARIANT[form.channel] || 'outline'}>{channelLabel}</Badge>
            </div>
            {form.subject && (
              <p className="font-medium text-foreground">{form.subject}</p>
            )}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {form.body || <span className="italic">No message yet</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Broadcast History</h2>
          <Button variant="outline" size="sm" onClick={load} aria-label="Refresh broadcast history">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">No broadcasts sent yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(b => (
              <div key={b.id} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1 justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">{b.recipients_filter}</Badge>
                    <Badge variant={CHANNEL_VARIANT[b.channel] || 'outline'} className="text-xs">{b.channel}</Badge>
                    <span className="text-xs text-muted-foreground">{b.delivered_count} clinics</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtDate(b.created_at)}</span>
                </div>
                {b.subject && <p className="text-sm font-medium text-foreground">{b.subject}</p>}
                <p className="text-sm text-muted-foreground line-clamp-2">{b.body}</p>
                <p className="text-xs text-muted-foreground">Sent by {b.created_by_email}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a <strong>{channelLabel}</strong> message to <strong>{recipientLabel}</strong>.
              This action cannot be undone and will be permanently logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={send} disabled={sending}>
              {sending ? 'Sending…' : 'Send Broadcast'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
