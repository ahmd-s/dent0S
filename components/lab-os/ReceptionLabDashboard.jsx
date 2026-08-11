'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import LabCaseCard from './LabCaseCard'
import { normalizeLabStatus } from '@/lib/lab-case-helpers'
import { toast } from 'sonner'

export default function ReceptionLabDashboard() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/lab-cases')
    const d = await r.json()
    setCases(d.lab_cases || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const readyForPickup = useMemo(() => cases.filter(c => normalizeLabStatus(c.status) === 'ready'), [cases])
  const delivered = useMemo(() => cases.filter(c => ['delivered', 'received'].includes(normalizeLabStatus(c.status))), [cases])
  const pendingDeliveries = useMemo(() => cases.filter(c => ['sent', 'lab_received', 'in_production', 'quality_check', 'in_progress'].includes(normalizeLabStatus(c.status))), [cases])
  const installSchedule = useMemo(() => delivered.filter(c => !c.installation_date), [delivered])

  const runAction = async (action, lc) => {
    const r = await fetch('/api/lab-cases/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: lc.id, action }),
    })
    if (r.ok) { toast.success('Updated'); load() }
    else toast.error((await r.json()).error || 'Failed')
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  return (
    <div className="space-y-6">
      {readyForPickup.length > 0 && (
        <Section title="Ready For Pickup" cases={readyForPickup} onAction={runAction} />
      )}
      {delivered.length > 0 && (
        <Section title="Delivered Cases" cases={delivered} onAction={runAction} />
      )}
      {pendingDeliveries.length > 0 && (
        <Section title="Pending Deliveries" cases={pendingDeliveries} showActions={false} />
      )}
      {installSchedule.length > 0 && (
        <Section title="Installation Schedule" cases={installSchedule} onAction={runAction} />
      )}
      {!readyForPickup.length && !delivered.length && !pendingDeliveries.length && (
        <p className="text-sm text-muted-foreground text-center py-8">No lab cases requiring reception action</p>
      )}
    </div>
  )
}

function Section({ title, cases, onAction, showActions = true }) {
  return (
    <section>
      <h4 className="text-sm font-semibold text-muted-foreground mb-2">{title} ({cases.length})</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cases.map(c => <LabCaseCard key={c.id} labCase={c} onAction={onAction} showActions={showActions} />)}
      </div>
    </section>
  )
}
