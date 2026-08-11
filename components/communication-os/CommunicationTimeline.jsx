'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'

const STATUS_ICON = {
  delivered: CheckCircle,
  sent: CheckCircle,
  failed: XCircle,
  scheduled: Clock,
  pending: Clock,
}

const STATUS_COLOR = {
  delivered: '#22C55E',
  sent: '#22C55E',
  failed: '#EF4444',
  scheduled: '#6366F1',
  pending: '#F59E0B',
}

export default function CommunicationTimeline({ patientId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = patientId
      ? `/api/communication/history?patient_id=${patientId}&limit=50`
      : '/api/communication/history?limit=30'
    fetch(url)
      .then(r => r.json())
      .then(d => { setMessages(d.messages || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [patientId])

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#0D9488]" /></div>

  return (
    <Card className="p-4 border-border">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />Communication Timeline
      </h3>
      <div className="space-y-3">
        {messages.map(m => {
          const Icon = STATUS_ICON[m.status] || MessageSquare
          const color = STATUS_COLOR[m.status] || '#94A3B8'
          return (
            <div key={m.id} className="flex gap-3 text-sm">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '15' }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span className="font-medium capitalize">{m.type?.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                {!patientId && m.patient_name && (
                  <div className="text-xs text-muted-foreground">{m.patient_name}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.body}</p>
                <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span className="capitalize">{m.channel}</span>
                  <span>·</span>
                  <span className="capitalize">{m.status}</span>
                  {m.retry_count > 0 && <><span>·</span><span>{m.retry_count} retries</span></>}
                  {m.read_status === 'unread' && <><span>·</span><span>Unread</span></>}
                </div>
              </div>
            </div>
          )
        })}
        {!messages.length && <p className="text-xs text-muted-foreground">No communication history yet.</p>}
      </div>
    </Card>
  )
}
