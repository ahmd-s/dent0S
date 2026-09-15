'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/components/dentos/RoleContext'
import LabCaseTable from './LabCaseTable'
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
  const delayed = active.filter(c => c.overdue || c.is_delayed)
  const delayedIds = new Set(delayed.map(c => c.id))
  const dueSoon = active.filter(c => !delayedIds.has(c.id) && c.days_remaining != null && c.days_remaining <= 3)
  const attentionIds = new Set([...delayed, ...dueSoon].map(c => c.id))
  const awaitingInstall = mine.filter(c => ['delivered', 'received'].includes(normalizeLabStatus(c.status)))
  const awaitingIds = new Set(awaitingInstall.map(c => c.id))
  const restActive = active.filter(c => !attentionIds.has(c.id) && !awaitingIds.has(c.id))
  const recentDelivered = mine.filter(c => normalizeLabStatus(c.status) === 'completed').slice(0, 5)

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{active.length} active cases</h2>
        <Button onClick={() => setOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" />New Case</Button>
      </div>

      {delayed.length > 0 && <Section title="Needs attention" cases={delayed} />}
      {dueSoon.length > 0 && <Section title="Due soon" cases={dueSoon} />}
      {awaitingInstall.length > 0 && <Section title="Ready to install" cases={awaitingInstall} />}
      {restActive.length > 0 && <Section title={attentionIds.size ? 'Other cases' : 'Active cases'} cases={restActive} />}
      {recentDelivered.length > 0 && <Section title="Recently completed" cases={recentDelivered} />}

      {!active.length && !recentDelivered.length && (
        <p className="text-sm text-muted-foreground text-center py-16">No lab cases yet</p>
      )}

      <NewLabCaseDialog open={open} setOpen={setOpen} onCreated={load} />
    </div>
  )
}

function Section({ title, cases }) {
  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      <LabCaseTable cases={cases} showActions={false} />
    </section>
  )
}
