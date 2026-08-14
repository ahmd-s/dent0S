'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Stethoscope, Clock, CheckCircle2, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'
import FlowAppointmentCard from './FlowAppointmentCard'
import { normalizeStatus } from '@/lib/appointment-status'
import { getWaitingMinutes } from '@/lib/flow-waiting-timer'

export default function DoctorFlowDashboard({ date, onRefresh }) {
  const { me } = useRole()
  const [appointments, setAppointments] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [qRes, sRes] = await Promise.all([
      fetch(`/api/appointments/queue?date=${date}`),
      fetch(`/api/appointments/flow/stats?date=${date}`),
    ])
    const [qData, sData] = await Promise.all([qRes.json(), sRes.json()])
    setAppointments(qData.all || [])
    setStats(sData.metrics || null)
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  const doctorId = me?.profile?.id
  const mine = useMemo(() => appointments.filter(a => a.doctor_id === doctorId), [appointments, doctorId])

  const currentPatient = mine.find(a => normalizeStatus(a.status) === 'in_treatment')
  const waiting = mine.filter(a => ['waiting', 'doctor_ready', 'checked_in'].includes(normalizeStatus(a.status)))
  const completed = mine.filter(a => normalizeStatus(a.status) === 'completed')
  const nextPatient = waiting.sort((a, b) => getWaitingMinutes(b) - getWaitingMinutes(a))[0]

  const runAction = async (action, appt) => {
    const r = await fetch('/api/appointments/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: appt.id, action }),
    })
    if (r.ok) { toast.success('Updated'); load(); onRefresh?.() }
    else toast.error((await r.json()).error || 'Failed')
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Stethoscope} label="Current Patient" value={currentPatient?.patient_name || '—'} highlight />
        <MetricCard icon={Clock} label="Waiting" value={waiting.length} />
        <MetricCard icon={CheckCircle2} label="Completed Today" value={completed.length} />
        <MetricCard icon={User} label="Avg Treatment" value={stats?.average_treatment_minutes ? `${stats.average_treatment_minutes}m` : '—'} />
      </div>

      {currentPatient && (
        <Card className="p-4 border-[#0D9488]/30 bg-[#0D9488]/5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#0D9488]" />Current Patient
          </h3>
          <FlowAppointmentCard appointment={currentPatient} onAction={runAction} role="doctor" />
        </Card>
      )}

      {nextPatient && !currentPatient && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Next Patient</h3>
          <FlowAppointmentCard appointment={nextPatient} onAction={runAction} role="doctor" />
        </Card>
      )}

      {waiting.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Waiting ({waiting.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {waiting.map(a => (
              <FlowAppointmentCard key={a.id} appointment={a} compact onAction={runAction} role="doctor" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, highlight }) {
  return (
    <Card className={`p-4 ${highlight ? 'border-[#0D9488]/40 bg-[#0D9488]/5' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-bold truncate">{value}</div>
    </Card>
  )
}
