'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import ActivityTimeline from './ActivityTimeline'
import WorkspaceGate from '@/components/workspace/WorkspaceGate'

export default function PatientTimelineTab({ patientId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/timeline/patient/${patientId}?limit=100`)
      const d = await r.json()
      if (r.ok) setEvents(d.events || [])
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <WorkspaceGate section="patient_page" flag="timeline">
      <div className="rounded-lg border border-border bg-card p-4 md:p-6">
        <ActivityTimeline
          events={events}
          loading={loading}
          emptyMessage="No timeline events for this patient yet."
        />
      </div>
    </WorkspaceGate>
  )
}
