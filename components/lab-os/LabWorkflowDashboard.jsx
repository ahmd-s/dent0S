'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import LabCaseCard from './LabCaseCard'
import { NewLabCaseDialog } from '@/components/dentos/NewLabCaseDialog'
import { CLOSED_STATUSES, normalizeLabStatus } from '@/lib/lab-case-helpers'

export default function LabWorkflowDashboard({ onRefresh }) {
  const [cases, setCases] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('active')

  const load = useCallback(async () => {
    setLoading(true)
    const [cRes, sRes] = await Promise.all([
      fetch('/api/lab-cases'),
      fetch('/api/lab-cases/flow/stats'),
    ])
    const [cData, sData] = await Promise.all([cRes.json(), sRes.json()])
    setCases(cData.lab_cases || [])
    setStats(sData.metrics || null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runAction = async (action, lc, extra = {}) => {
    const r = await fetch('/api/lab-cases/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: lc.id, action, ...extra }),
    })
    if (r.ok) {
      toast.success('Updated')
      load()
      onRefresh?.()
    } else {
      toast.error((await r.json()).error || 'Failed')
    }
  }

  const visible = useMemo(() => {
    if (filter === 'active') return cases.filter(c => !CLOSED_STATUSES.includes(normalizeLabStatus(c.status)))
    if (filter === 'delayed') return cases.filter(c => c.overdue || c.is_delayed)
    if (filter === 'due_today') {
      const today = new Date().toISOString().slice(0, 10)
      return cases.filter(c => c.expected_delivery_date === today && !CLOSED_STATUSES.includes(normalizeLabStatus(c.status)))
    }
    return cases
  }, [cases, filter])

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  const filters = [
    { id: 'active', label: 'Active', count: stats?.open_cases },
    { id: 'due_today', label: 'Due Today', count: stats?.due_today },
    { id: 'delayed', label: 'Delayed', count: stats?.delayed_cases },
    { id: 'all', label: 'All', count: stats?.total_cases },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.id ? 'bg-[#0D9488] text-white border-[#0D9488]' : 'border-border hover:bg-muted'
              }`}
            >
              {f.label}{f.count != null ? ` (${f.count})` : ''}
            </button>
          ))}
        </div>
        <Button onClick={() => setOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73] h-9">
          <Plus className="w-4 h-4 mr-1" />New Lab Case
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(c => (
          <LabCaseCard key={c.id} labCase={c} onAction={runAction} />
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-12 text-center">No lab cases found</p>
        )}
      </div>

      <NewLabCaseDialog open={open} setOpen={setOpen} onCreated={load} />
    </div>
  )
}
