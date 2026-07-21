'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRole } from '@/components/dentos/RoleContext'

export default function ReceptionistPendingTasks() {
  const { isReceptionist, canManageBilling, canManageInventory } = useRole()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const show = isReceptionist() || canManageBilling() || canManageInventory()

  const load = () => {
    fetch('/api/visits/pending-tasks')
      .then(r => r.json())
      .then(d => setTasks(d.tasks || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (show) load()
    else setLoading(false)
  }, [show])

  if (!show || (!loading && tasks.length === 0)) return null

  return (
    <Card className="p-4 md:p-5 bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-5 h-5 text-amber-700 dark:text-amber-400" />
        <h3 className="font-semibold text-foreground">Pending visit tasks</h3>
      </div>
      {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      {!loading && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">No assigned tasks</p>
      )}
      <ul className="space-y-2">
        {tasks.map((t, i) => (
          <li key={`${t.visit_id}-${t.step}-${i}`} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <span className="font-medium">{t.patient_name}</span>
              <span className="text-muted-foreground ml-2 capitalize">{t.step} step</span>
            </div>
            <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
              <Link href={`/visits/${t.visit_id}`}>Open</Link>
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
