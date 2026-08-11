'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, PhoneForwarded } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import AppointmentCard from './AppointmentCard'
import { toast } from 'sonner'

const COLUMNS = [
  { id: 'checked_in', label: 'Checked In', statuses: ['checked_in', 'arrived'] },
  { id: 'waiting', label: 'Waiting', statuses: ['waiting'] },
  { id: 'called', label: 'Called', statuses: ['called'] },
  { id: 'in_treatment', label: 'In Chair', statuses: ['in_treatment', 'in_progress'] },
  { id: 'completed', label: 'Completed', statuses: ['completed'] },
]

function matchColumn(status) {
  const s = status?.toLowerCase()
  for (const col of COLUMNS) {
    if (col.statuses.includes(s)) return col.id
  }
  return null
}

export default function QueueBoard({ date, onRefresh, onStartVisit, onBalanceClick }) {
  const [queue, setQueue] = useState([])
  const [allAppts, setAllAppts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/appointments/queue?date=${date}`)
    const d = await r.json()
    setQueue(d.queue || [])
    setAllAppts(d.all || d.queue || [])
    setStats(d.stats || null)
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  const setStatus = async (id, status) => {
    const r = await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (r.ok) { toast.success('Updated'); load(); onRefresh?.() }
    else toast.error('Failed to update')
  }

  const callNext = async () => {
    const r = await fetch('/api/appointments/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'call_next', date }),
    })
    if (r.ok) { toast.success('Patient called'); load(); onRefresh?.() }
    else toast.error((await r.json()).error || 'No patients waiting')
  }

  const onDrop = async (targetCol, e) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('appointmentId') || dragId
    if (!id) return
    const statusMap = {
      checked_in: 'checked_in',
      waiting: 'waiting',
      called: 'called',
      in_treatment: 'in_treatment',
      completed: 'completed',
    }
    await setStatus(id, statusMap[targetCol])
    setDragId(null)
  }

  const grouped = {}
  for (const col of COLUMNS) grouped[col.id] = []
  for (const a of queue) {
    const col = matchColumn(a.status)
    if (col) grouped[col].push(a)
  }
  // Include scheduled/confirmed in checked_in column preview
  const scheduled = allAppts.filter(a => ['scheduled', 'confirmed'].includes(a.status))

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-3 text-sm">
          {stats && (
            <>
              <span className="text-muted-foreground">Waiting: <strong>{stats.waiting + stats.checked_in}</strong></span>
              <span className="text-muted-foreground">Called: <strong>{stats.called}</strong></span>
              <span className="text-muted-foreground">In chair: <strong>{stats.in_treatment}</strong></span>
            </>
          )}
        </div>
        <Button onClick={callNext} className="bg-violet-600 hover:bg-violet-700 h-9">
          <PhoneForwarded className="w-4 h-4 mr-1.5" />Call Next
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {COLUMNS.map(col => (
          <Card
            key={col.id}
            className="p-3 min-h-[200px] bg-muted/30"
            onDragOver={e => e.preventDefault()}
            onDrop={e => onDrop(col.id, e)}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{col.label}</h3>
            <div className="space-y-2">
              {(grouped[col.id] || []).map(a => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('appointmentId', a.id); setDragId(a.id) }}
                >
                  <AppointmentCard appointment={a} compact onBalanceClick={onBalanceClick} />
                  <div className="flex gap-1 mt-1">
                    {col.id === 'called' && (
                      <Button size="sm" className="h-7 text-xs flex-1 bg-[#0D9488]" onClick={() => onStartVisit?.(a)}>Start Visit</Button>
                    )}
                    {col.id === 'checked_in' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setStatus(a.id, 'waiting')}>To Waiting</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {scheduled.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Upcoming (not yet checked in)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {scheduled.map(a => (
              <div key={a.id} className="flex items-center gap-2">
                <AppointmentCard appointment={a} compact />
                <Button size="sm" className="h-8 text-xs bg-blue-600 shrink-0" onClick={() => setStatus(a.id, 'checked_in')}>Check In</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
