'use client'

import { useEffect, useState } from 'react'
import { Loader2, Package, IndianRupee } from 'lucide-react'
import { Card } from '@/components/ui/card'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export default function PatientInventoryPanel({ patientId, readonly = true }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/patients/${patientId}/inventory`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [patientId])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#0D9488]" /></div>
  }

  const materials = data?.materials_used?.filter(m =>
    ['STOCK_OUT', 'AUTO_CONSUMPTION', 'STOCK_CONSUMED'].includes(m.movement_type)
  ) || []

  return (
    <div className="space-y-4">
      {readonly && (
        <p className="text-xs text-muted-foreground">Read-only view of materials consumed for this patient.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Materials Used</div>
          <div className="text-2xl font-bold flex items-center gap-2 mt-1">
            <Package className="w-5 h-5 text-[#0D9488]" />
            {materials.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Treatment Material Cost</div>
          <div className="text-2xl font-bold flex items-center gap-2 mt-1">
            <IndianRupee className="w-5 h-5 text-[#0D9488]" />
            {(data?.total_cost || 0).toLocaleString('en-IN')}
          </div>
        </Card>
      </div>

      {data?.by_visit?.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Cost Breakdown by Visit</h3>
          {data.by_visit.map((v, i) => (
            <div key={v.visit_id || i} className="mb-3 pb-3 border-b border-border/50 last:border-0">
              <div className="text-xs text-muted-foreground mb-1">
                {v.date ? new Date(v.date).toLocaleDateString() : 'Visit'}
              </div>
              {v.items.map((it, j) => (
                <div key={j} className="flex justify-between text-sm">
                  <span>{it.item_name} × {it.quantity}</span>
                  <span className="text-muted-foreground">{inr(it.cost)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Consumption Timeline</h3>
        {!data?.timeline?.length && <p className="text-sm text-muted-foreground">No inventory consumption recorded.</p>}
        <div className="space-y-2">
          {(data?.timeline || []).slice(0, 20).map(entry => (
            <div key={entry.id} className="flex justify-between text-sm">
              <span>
                {entry.item_name} × {entry.quantity}
                {entry.treatment_name && <span className="text-muted-foreground ml-1">({entry.treatment_name})</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
