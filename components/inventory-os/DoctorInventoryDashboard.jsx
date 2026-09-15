'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import InventoryTable from './InventoryTable'

export default function DoctorInventoryDashboard() {
  const [items, setItems] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [dRes, sRes] = await Promise.all([
      fetch('/api/inventory/dashboard'),
      fetch('/api/inventory/flow/stats'),
    ])
    const [dData, sData] = await Promise.all([dRes.json(), sRes.json()])
    setItems(dData.items || [])
    setMetrics(sData.metrics || dData.metrics)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runAction = async (action, item) => {
    const qty = action === 'consume' ? 1 : prompt('Quantity?', '1')
    if (!qty) return
    const r = await fetch('/api/inventory/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, action, quantity: parseFloat(qty) }),
    })
    if (r.ok) { toast.success('Done'); load() }
    else toast.error((await r.json()).error || 'Failed')
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  const frequent = items.filter(i => (i.current_stock || 0) > 0).slice(0, 8)
  const warnings = items.filter(i => ['low_stock', 'critical', 'out_of_stock', 'expired'].includes(i.status))

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Used today <span className="text-foreground font-medium tabular-nums">{metrics?.today_consumption ?? 0}</span>
        {warnings.length > 0 && (
          <span>
            {' · '}
            <span className="text-amber-600 font-medium tabular-nums">{warnings.length}</span> need attention
          </span>
        )}
      </p>

      {warnings.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {warnings.slice(0, 5).map(i => i.item_name).join(' · ')}
          {warnings.length > 5 ? ` · +${warnings.length - 5} more` : ''}
        </p>
      )}

      {(metrics?.top_consumed || []).length > 0 && (
        <p className="text-sm text-muted-foreground">
          Most used this month: {(metrics.top_consumed || []).slice(0, 3).map(t => t.item_name).join(' · ')}
        </p>
      )}

      <InventoryTable items={frequent} onAction={runAction} empty="No items in stock" />
    </div>
  )
}
