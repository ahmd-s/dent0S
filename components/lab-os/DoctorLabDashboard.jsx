'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/components/dentos/RoleContext'
import LabCaseCard from './LabCaseCard'
import { NewLabCaseDialog } from '@/components/dentos/NewLabCaseDialog'
import { CLOSED_STATUSES, normalizeLabStatus } from '@/lib/lab-case-helpers'

export default function DoctorLabDashboard() {
  const { me } = useRole()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/lab-cases')
    const d = await r.json()
    setCases(d.lab_cases || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const doctorId = me?.profile?.id
  const mine = useMemo(() => cases.filter(c => c.created_by === doctorId), [cases, doctorId])
  const active = mine.filter(c => !CLOSED_STATUSES.includes(normalizeLabStatus(c.status)))
  const due = active.filter(c => c.days_remaining != null && c.days_remaining <= 3)
  const delayed = active.filter(c => c.overdue || c.is_delayed)
  const awaitingInstall = mine.filter(c => ['delivered', 'received'].includes(normalizeLabStatus(c.status)))
  const recentDelivered = mine.filter(c => normalizeLabStatus(c.status) === 'completed').slice(0, 5)

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">My Lab Cases ({active.length} active)</h3>
        <Button onClick={() => setOpen(true)} size="sm" className="bg-[#0D9488]"><Plus className="w-4 h-4 mr-1" />New Case</Button>
      </div>

      {due.length > 0 && <Section title="Due Soon" cases={due} />}
      {delayed.length > 0 && <Section title="Delayed" cases={delayed} />}
      {awaitingInstall.length > 0 && <Section title="Awaiting Installation" cases={awaitingInstall} />}
      {active.length > 0 && <Section title="Active Cases" cases={active} />}
      {recentDelivered.length > 0 && <Section title="Recently Completed" cases={recentDelivered} compact />}

      <NewLabCaseDialog open={open} setOpen={setOpen} onCreated={load} />
    </div>
  )
}

function Section({ title, cases, compact }) {
  return (
    <section>
      <h4 className="text-sm font-medium text-muted-foreground mb-2">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cases.map(c => <LabCaseCard key={c.id} labCase={c} showActions={false} compact={compact} />)}
      </div>
    </section>
  )
}
