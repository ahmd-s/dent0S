'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import InventoryItemCard from './InventoryItemCard'

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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>

  const frequent = items.filter(i => (i.current_stock || 0) > 0).slice(0, 8)
  const warnings = items.filter(i => ['low_stock', 'critical', 'out_of_stock'].includes(i.status))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs text-muted-foreground">Today&apos;s Consumption</div>
          <div className="text-2xl font-bold text-[#0D9488]">{metrics?.today_consumption ?? 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs text-muted-foreground">Low Stock Warnings</div>
          <div className="text-2xl font-bold text-amber-600">{warnings.length}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card col-span-2">
          <div className="text-xs text-muted-foreground mb-1">Top Consumed This Month</div>
          {(metrics?.top_consumed || []).slice(0, 3).map(t => (
            <div key={t.item_name} className="text-sm flex justify-between">
              <span>{t.item_name}</span>
              <span className="text-muted-foreground">{t.total}</span>
            </div>
          ))}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Low stock warnings</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {warnings.slice(0, 5).map(i => i.item_name).join(', ')}
          </p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Frequently Used Materials</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {frequent.map(item => (
            <InventoryItemCard key={item.id} item={item} compact onAction={runAction} />
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
    </div>
  )
}
