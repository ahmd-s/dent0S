'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, ExternalLink, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const FILTERS = [
  { id: 'action_required', label: 'Action required' },
  { id: 'due_now', label: 'Due now' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
]

const STATUS_LABELS = {
  action_required: 'Manual send required',
  queued: 'Queued',
  scheduled: 'Scheduled',
  processing: 'Processing',
  accepted: 'Accepted',
  sent: 'Sent',
  failed: 'Failed',
  cancelled: 'Cancelled',
  retry_scheduled: 'Retry scheduled',
  expired: 'Expired',
}

function StatusBadge({ status }) {
  const colors = {
    action_required: 'bg-amber-100 text-amber-800 border-amber-200',
    sent: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    accepted: 'bg-blue-100 text-blue-800 border-blue-200',
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colors[status] || 'bg-muted text-muted-foreground border-border'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export default function CommunicationQueuePanel() {
  const [filter, setFilter] = useState('action_required')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [openedIds, setOpenedIds] = useState(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/communication/messages?filter=${filter}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      toast.error('Failed to load communication queue')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function openWhatsApp(message) {
    setActing(message.id)
    try {
      const res = await fetch(`/api/communication/messages/${message.id}/whatsapp-url`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get WhatsApp URL')

      await fetch(`/api/communication/messages/${message.id}/opened`, { method: 'POST' })
      setOpenedIds(prev => new Set(prev).add(message.id))
      window.open(data.whatsapp_url, '_blank', 'noopener,noreferrer')
      toast.message('Manual WhatsApp send required', {
        description: 'Press Send in WhatsApp, then click Mark as sent.',
      })
    } catch (e) {
      toast.error(e.message || 'Could not open WhatsApp')
    } finally {
      setActing(null)
    }
  }

  async function markSent(messageId) {
    setActing(messageId)
    try {
      const res = await fetch(`/api/communication/messages/${messageId}/mark-sent`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to mark as sent')
      toast.success('Message marked as sent')
      load()
    } catch (e) {
      toast.error(e.message || 'Failed to mark as sent')
    } finally {
      setActing(null)
    }
  }

  async function cancelMessage(messageId) {
    setActing(messageId)
    try {
      const res = await fetch(`/api/communication/messages/${messageId}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel')
      toast.success('Message cancelled')
      load()
    } catch (e) {
      toast.error(e.message || 'Failed to cancel')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Communication Queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manual WhatsApp send required for click-to-chat messages. Delivery/read status is not tracked.
          </p>
        </div>
        <div className="flex bg-muted border border-border rounded-md p-0.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${filter === f.id ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No messages in this queue.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium capitalize">{msg.type?.replace(/_/g, ' ')}</span>
                    <StatusBadge status={msg.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {msg.recipient_e164}
                    {msg.scheduled_at ? ` · due ${new Date(msg.scheduled_at).toLocaleString()}` : ''}
                  </div>
                </div>
                {msg.manual_send_required && msg.status === 'action_required' && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    Manual WhatsApp send required
                  </div>
                )}
              </div>

              <div className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3 border border-border/60">
                {msg.body}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {msg.status === 'action_required' && (
                  <>
                    <Button
                      size="sm"
                      className="bg-[#25D366] hover:bg-[#1ebe57] text-white"
                      disabled={acting === msg.id}
                      onClick={() => openWhatsApp(msg)}
                    >
                      {acting === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1" />}
                      Send on WhatsApp
                    </Button>
                    {(openedIds.has(msg.id) || msg.opened_at) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting === msg.id}
                        onClick={() => markSent(msg.id)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Mark as sent
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={acting === msg.id}
                      onClick={() => cancelMessage(msg.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                )}
                {['queued', 'scheduled'].includes(msg.status) && (
                  <Button size="sm" variant="ghost" disabled={acting === msg.id} onClick={() => cancelMessage(msg.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
