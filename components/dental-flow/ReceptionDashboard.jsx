'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import FlowAppointmentCard from './FlowAppointmentCard'
import WaitingTimer from './WaitingTimer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export default function ReceptionDashboard({ date, onRefresh }) {
  const [appointments, setAppointments] = useState([])
  const [stats, setStats] = useState(null)
  const [chairs, setChairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [chairModal, setChairModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [qRes, sRes, cRes] = await Promise.all([
      fetch(`/api/appointments/queue?date=${date}`),
      fetch(`/api/appointments/flow/stats?date=${date}`),
      fetch('/api/chairs'),
    ])
    const [qData, sData, cData] = await Promise.all([qRes.json(), sRes.json(), cRes.json()])
    setAppointments(qData.all || [])
    setStats(sData.metrics || null)
    setChairs(cData.chairs || [])
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  const runAction = async (action, appt, extra = {}) => {
    if (action === 'assign_chair' || action === 'change_chair') {
      setChairModal({ action, appt })
      return
    }
    const r = await fetch('/api/appointments/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: appt.id, action, ...extra }),
    })
    if (r.ok) {
      toast.success('Updated')
      load()
      onRefresh?.()
    } else {
      toast.error((await r.json()).error || 'Failed')
    }
  }

  const assignChair = async chairId => {
    if (!chairModal) return
    await runAction(chairModal.action, chairModal.appt, { chair_id: chairId })
    setChairModal(null)
  }

  const active = appointments.filter(a => !['cancelled', 'no_show', 'archived'].includes(a.status))
  const scheduled = active.filter(a => ['scheduled', 'confirmed'].includes(a.status))
  const inFlow = active.filter(a => !['scheduled', 'confirmed', 'completed'].includes(a.status))

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  return (
    <div className="space-y-4">
      <WaitingTimer stats={stats} appointments={appointments} />

      {scheduled.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Scheduled — awaiting check-in</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scheduled.map(a => (
              <FlowAppointmentCard key={a.id} appointment={a} onAction={runAction} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Active Flow ({inFlow.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {inFlow.map(a => (
            <FlowAppointmentCard key={a.id} appointment={a} onAction={runAction} />
          ))}
          {inFlow.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full py-8 text-center">No patients in active flow</p>
          )}
        </div>
      </section>

      <Dialog open={!!chairModal} onOpenChange={v => !v && setChairModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Chair</DialogTitle></DialogHeader>
          <Select onValueChange={assignChair}>
            <SelectTrigger><SelectValue placeholder="Select chair" /></SelectTrigger>
            <SelectContent>
              {chairs.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setChairModal(null)}>Cancel</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
