'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ActivityTimeline from '@/components/dentos/ActivityTimeline'
import { ALL_ACTIVITY_MODULES, MODULE_LABELS } from '@/lib/activity-event-registry'

export default function PatientTimelinePanel({ patientId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState('')
  const [from, setFrom] = useState('')

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (module) params.set('module', module)
      if (from) params.set('from', from)
      const r = await fetch(`/api/timeline/patient/${patientId}?${params}`)
      const d = await r.json()
      if (r.ok) setEvents(d.events || [])
    } finally {
      setLoading(false)
    }
  }, [patientId, module, from])

  useEffect(() => { load() }, [load])

  return (
    <Card className="p-4 md:p-6 bg-card border-border rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-foreground">Patient Timeline</h2>
        <div className="flex flex-wrap gap-2">
          <Select value={module || 'all'} onValueChange={v => setModule(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="All modules" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {ALL_ACTIVITY_MODULES.map(m => (
                <SelectItem key={m} value={m}>{MODULE_LABELS[m] || m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-[140px] h-8 text-xs" />
          <Button size="sm" variant="outline" className="h-8" onClick={() => { setModule(''); setFrom('') }}>Clear</Button>
          <Button size="sm" className="h-8 bg-[#0D9488]" onClick={load}>Apply</Button>
        </div>
      </div>
      <ActivityTimeline events={events} loading={loading} emptyMessage="No timeline events for this patient yet." />
    </Card>
  )
}
