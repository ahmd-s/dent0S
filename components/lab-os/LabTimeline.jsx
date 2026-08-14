'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getEventLabel } from '@/lib/activity-event-registry'

export default function LabTimeline({ labCaseId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!labCaseId) return
    setLoading(true)
    fetch(`/api/timeline/visit/${labCaseId}?limit=50`)
      .catch(() => null)
    // Use activity engine lab timeline if available, fallback to case timeline
    Promise.all([
      fetch(`/api/lab-cases/${labCaseId}`).then(r => r.json()).catch(() => ({})),
    ]).then(async ([caseData]) => {
      const lc = caseData.lab_case
      const timelineEvents = (lc?.timeline || []).map(t => ({
        id: `${t.status}-${t.at}`,
        event: mapStatusToEvent(t.status),
        created_at: t.at,
        actor: { name: t.by_name },
        metadata: { note: t.note, source: t.source },
      }))
      setEvents(timelineEvents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      setLoading(false)
    })
  }, [labCaseId])

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#0D9488]" /></div>
  }

  if (!events.length) {
    return <p className="text-sm text-muted-foreground py-4">No timeline events yet</p>
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-4">Lab Timeline</h3>
      <div className="space-y-0">
        {events.map((e, i) => (
          <div key={e.id || i} className="flex gap-3 pb-4 last:pb-0">
            <CheckCircle2 className="w-4 h-4 text-[#0D9488] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{getEventLabel(e.event) || e.event?.replace(/_/g, ' ')}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                {e.actor?.name && ` · ${e.actor.name}`}
                {e.metadata?.note && ` — ${e.metadata.note}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function mapStatusToEvent(status) {
  const map = {
    pending: 'LAB_CREATED',
    impression_ready: 'IMPRESSION_UPLOADED',
    sent: 'LAB_SENT',
    lab_received: 'LAB_RECEIVED',
    in_production: 'LAB_MANUFACTURING_STARTED',
    in_progress: 'LAB_MANUFACTURING_STARTED',
    quality_check: 'LAB_QC_STARTED',
    ready: 'LAB_DISPATCHED',
    delivered: 'LAB_DELIVERED',
    received: 'LAB_DELIVERED',
    installed: 'LAB_INSTALLED',
    completed: 'LAB_COMPLETED',
    cancelled: 'LAB_STATUS_UPDATED',
  }
  return map[status] || 'LAB_STATUS_UPDATED'
}
