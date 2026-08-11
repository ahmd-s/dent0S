'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import FlowAppointmentCard from './FlowAppointmentCard'
import { FLOW_QUEUE_COLUMNS, matchFlowColumn, FLOW_COLUMN_STATUS } from '@/lib/appointment-status'

export default function FlowQueueBoard({ date, onRefresh, onStartVisit, role = 'reception' }) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/appointments/queue?date=${date}`)
    const d = await r.json()
    setQueue(d.queue || [])
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  const runAction = async (action, appt, extra = {}) => {
    const r = await fetch('/api/appointments/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: appt.id, action, ...extra }),
    })
    if (r.ok) { toast.success('Updated'); load(); onRefresh?.() }
    else toast.error((await r.json()).error || 'Failed')
  }

  const onDrop = async (colId, e) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('appointmentId') || dragId
    if (!id) return
    const status = FLOW_COLUMN_STATUS[colId]
    if (!status) return
    const r = await fetch('/api/appointments/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: id, action: 'move_column', column: colId }),
    })
    if (r.ok) { toast.success('Moved'); load(); onRefresh?.() }
    else toast.error((await r.json()).error || 'Cannot move to this stage')
    setDragId(null)
  }

  const grouped = {}
  for (const col of FLOW_QUEUE_COLUMNS) grouped[col.id] = []
  for (const a of queue) {
    const col = matchFlowColumn(a.status)
    if (col) grouped[col].push(a)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {FLOW_QUEUE_COLUMNS.map(col => (
        <Card
          key={col.id}
          className="p-3 min-h-[220px] bg-muted/30"
          onDragOver={e => e.preventDefault()}
          onDrop={e => onDrop(col.id, e)}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
            {col.label}
            <span className="text-[10px] font-normal">{(grouped[col.id] || []).length}</span>
          </h3>
          <div className="space-y-2">
            {(grouped[col.id] || []).map(a => (
              <div
                key={a.id}
                draggable
                onDragStart={e => { e.dataTransfer.setData('appointmentId', a.id); setDragId(a.id) }}
              >
                <FlowAppointmentCard
                  appointment={a}
                  compact
                  showActions={role !== 'doctor' || ['doctor_ready', 'in_treatment', 'treatment_paused', 'lab_pending'].includes(a.status)}
                  onAction={runAction}
                />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
