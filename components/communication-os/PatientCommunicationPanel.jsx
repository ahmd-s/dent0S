'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Send, MessageSquare, Clock, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import CommunicationTimeline from './CommunicationTimeline'

export default function PatientCommunicationPanel({ patientId, patientName }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [optedIn, setOptedIn] = useState(false)
  const [optSaving, setOptSaving] = useState(false)

  const load = useCallback(() => {
    if (!patientId) return
    Promise.all([
      fetch(`/api/communication/dashboard?patient_id=${patientId}`).then(r => r.json()),
      fetch(`/api/communication/preferences?patient_id=${patientId}`).then(r => r.json()),
    ])
      .then(([dash, prefs]) => {
        setData(dash)
        setOptedIn(prefs?.whatsapp_opted_in === true)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [patientId])

  useEffect(() => { load() }, [load])

  const send = async (type) => {
    setSending(true)
    const r = await fetch('/api/communication/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        patientId,
        body: message || undefined,
      }),
    })
    setSending(false)
    if (r.ok) {
      toast.success('Message sent')
      setMessage('')
      load()
    } else toast.error('Send failed')
  }

  const sendManual = async () => {
    if (!message.trim()) return toast.error('Enter a message')
    setSending(true)
    const r = await fetch('/api/communication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', patient_id: patientId, body: message }),
    })
    setSending(false)
    if (r.ok) {
      toast.success('Message sent')
      setMessage('')
      load()
    } else toast.error('Send failed')
  }

  const toggleOptIn = async (next) => {
    setOptSaving(true)
    try {
      const r = await fetch('/api/communication/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          action: next ? 'opt_in' : 'opt_out',
          source: 'staff_patient_panel',
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Could not update WhatsApp consent')
      setOptedIn(next)
      toast.success(next ? 'WhatsApp updates enabled for this patient' : 'WhatsApp updates stopped for this patient')
    } catch (e) {
      toast.error(e.message || 'Could not update WhatsApp consent')
    } finally {
      setOptSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#0D9488]" /></div>

  return (
    <div className="space-y-4">
      <Card className="p-3 border-border flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">WhatsApp appointment updates</div>
          <div className="text-xs text-muted-foreground">Required before booking and visit summaries can auto-send.</div>
        </div>
        <Switch checked={optedIn} disabled={optSaving} onCheckedChange={toggleOptIn} />
      </Card>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-3 border-border">
          <div className="text-xs text-muted-foreground">Last Communication</div>
          <div className="text-sm font-medium mt-1 truncate">
            {data?.last_communication?.type?.replace(/_/g, ' ') || 'None'}
          </div>
          {data?.last_communication?.created_at && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {new Date(data.last_communication.created_at).toLocaleString()}
            </div>
          )}
        </Card>
        <Card className="p-3 border-border">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Next Scheduled</div>
          <div className="text-sm font-medium mt-1 truncate">
            {data?.next_scheduled?.type?.replace(/_/g, ' ') || 'None'}
          </div>
        </Card>
        <Card className="p-3 border-border">
          <div className="text-xs text-muted-foreground">Scheduled</div>
          <div className="text-2xl font-bold tabular-nums">{data?.scheduled_messages?.length || 0}</div>
        </Card>
      </div>

      <Card className="p-4 border-border space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />Quick Actions — {patientName}
        </h3>
        <Textarea
          placeholder="Type a message or leave blank for template..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={sendManual} disabled={sending} className="bg-[#0D9488] hover:bg-[#0D9488]/90">
            <Send className="w-3 h-3 mr-1" />Send Manual
          </Button>
          <Button size="sm" variant="outline" onClick={() => send('followup')} disabled={sending}>Follow-up</Button>
          <Button size="sm" variant="outline" onClick={() => send('payment')} disabled={sending}>Payment</Button>
          <Button size="sm" variant="outline" onClick={() => send('review')} disabled={sending}>Review</Button>
          <Button size="sm" variant="outline" onClick={() => send('appointment')} disabled={sending}>
            <Zap className="w-3 h-3 mr-1" />Appointment
          </Button>
        </div>
      </Card>

      <CommunicationTimeline patientId={patientId} />
    </div>
  )
}
