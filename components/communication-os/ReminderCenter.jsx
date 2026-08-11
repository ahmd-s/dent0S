'use client'

import { useEffect, useState } from 'react'
import { Loader2, Bell, RotateCcw, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const REMINDER_TYPES = [
  { type: 'appointment', label: 'Appointment Reminder', desc: '1 day & 2 hours before' },
  { type: 'followup', label: 'Follow-up Reminder', desc: 'When follow-up is due' },
  { type: 'payment', label: 'Payment Reminder', desc: 'Outstanding balance' },
  { type: 'lab', label: 'Lab Ready', desc: 'When lab work is ready' },
  { type: 'review', label: 'Review Request', desc: 'After completed visit' },
  { type: 'birthday', label: 'Birthday Wish', desc: 'On patient birthday' },
]

export default function ReminderCenter() {
  const [scheduled, setScheduled] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoScheduling, setAutoScheduling] = useState(false)

  const load = () => {
    fetch('/api/communication/history?status=scheduled&limit=20')
      .then(r => r.json())
      .then(d => { setScheduled(d.messages || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const autoSchedule = async () => {
    setAutoScheduling(true)
    const r = await fetch('/api/communication/reminders?action=auto_schedule')
    const d = await r.json()
    setAutoScheduling(false)
    if (r.ok) {
      toast.success(`Scheduled ${d.scheduled || 0} reminders`)
      load()
    } else toast.error('Auto-schedule failed')
  }

  const retry = async (messageId) => {
    const r = await fetch('/api/communication/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'retry', message_id: messageId }),
    })
    if (r.ok) { toast.success('Retry attempted'); load() }
    else toast.error('Retry failed')
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Automated reminder system — batch scheduling ready.</p>
        <Button size="sm" onClick={autoSchedule} disabled={autoScheduling} className="bg-[#0D9488] hover:bg-[#0D9488]/90">
          {autoScheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-3 h-3 mr-1" />Auto-Schedule All</>}
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REMINDER_TYPES.map(r => (
          <Card key={r.type} className="p-3 border-border">
            <div className="flex items-start gap-2">
              <Bell className="w-4 h-4 text-[#0D9488] mt-0.5" />
              <div>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4 border-border">
        <h3 className="text-sm font-semibold mb-3">Scheduled Messages</h3>
        <div className="space-y-2">
          {scheduled.map(m => (
            <div key={m.id} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0">
              <span>{m.patient_name || 'Patient'} · {m.type?.replace(/_/g, ' ')}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : '—'}</span>
                {m.status === 'failed' && (
                  <Button size="sm" variant="ghost" onClick={() => retry(m.id)}><RotateCcw className="w-3 h-3" /></Button>
                )}
              </div>
            </div>
          ))}
          {!scheduled.length && <p className="text-xs text-muted-foreground">No scheduled reminders.</p>}
        </div>
      </Card>
    </div>
  )
}
