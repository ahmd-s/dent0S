'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { chairStatusLabel, CHAIR_STATUS_COLORS } from '@/lib/chair-status'

export default function ChairBoard({ date, onRefresh }) {
  const [chairs, setChairs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/chairs/board?date=${date}`)
    const d = await r.json()
    setChairs(d.chairs || [])
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  const action = async (chairId, act, extra = {}) => {
    const r = await fetch('/api/chairs/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chair_id: chairId, action: act, ...extra }),
    })
    if (r.ok) { toast.success('Updated'); load(); onRefresh?.() }
    else toast.error((await r.json()).error || 'Failed')
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {chairs.map(chair => (
        <Card key={chair.id} className="p-4 border-border" style={{ borderTopColor: chair.color, borderTopWidth: 3 }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold">{chair.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${CHAIR_STATUS_COLORS[chair.status] || CHAIR_STATUS_COLORS.available}`}>
                {chairStatusLabel(chair.status)}
              </span>
            </div>
            {chair.occupied_minutes > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{chair.occupied_minutes} min</span>
            )}
          </div>

          {chair.appointment ? (
            <div className="space-y-1 text-sm">
              <div className="font-medium">{chair.appointment.patient_name}</div>
              <div className="text-xs text-muted-foreground">Dr. {chair.appointment.doctor_name}</div>
              {chair.appointment.chief_complaint && (
                <div className="text-xs text-muted-foreground truncate">{chair.appointment.chief_complaint}</div>
              )}
              {chair.appointment.patient_id && (
                <Link href={`/patients/${chair.appointment.patient_id}`} className="text-xs text-[#0D9488] hover:underline">View patient</Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No patient assigned</p>
          )}

          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
            {chair.status === 'occupied' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => action(chair.id, 'release')}>Release</Button>
            )}
            {chair.status === 'cleaning' && (
              <Button size="sm" className="h-7 text-xs bg-[#0D9488]" onClick={() => action(chair.id, 'cleaning_complete')}>Ready</Button>
            )}
            {chair.status === 'available' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => action(chair.id, 'set_status', { status: 'out_of_service' })}>Out of Service</Button>
            )}
            {chair.status === 'out_of_service' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => action(chair.id, 'set_status', { status: 'available' })}>Enable</Button>
            )}
          </div>
        </Card>
      ))}
      <Button variant="ghost" size="sm" className="col-span-full" onClick={load}>
        <RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh
      </Button>
    </div>
  )
}
