'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import InventoryItemCard from './InventoryItemCard'
import PurchasePanel from './PurchasePanel'
import StockAlertsPanel from './StockAlertsPanel'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'healthy', label: 'Healthy' },
  { id: 'low_stock', label: 'Low Stock' },
  { id: 'critical', label: 'Critical' },
  { id: 'expired', label: 'Expired' },
  { id: 'out_of_stock', label: 'Out of Stock' },
]

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export default function InventoryDashboard({ compact = false, showPurchases = true, showAlerts = true }) {
  const [items, setItems] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [actionItem, setActionItem] = useState(null)
  const [actionType, setActionType] = useState(null)
  const [qty, setQty] = useState('1')

  const load = useCallback(async () => {
    setLoading(true)
    const q = search ? `?q=${encodeURIComponent(search)}` : ''
    const [dRes, pRes] = await Promise.all([
      fetch(`/api/inventory/dashboard${q}`),
      showPurchases ? fetch('/api/inventory/purchases?status=requested') : Promise.resolve(null),
    ])
    const dData = await dRes.json()
    setItems(dData.items || [])
    setMetrics(dData.metrics || null)
    setAlerts(dData.alerts || null)
    if (pRes) await pRes.json()
    setLoading(false)
  }, [search, showPurchases])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    let list = items
    if (filter !== 'all') list = list.filter(i => i.status === filter)
    return list
  }, [items, filter])

  const runAction = async () => {
    if (!actionItem || !actionType) return
    const r = await fetch('/api/inventory/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: actionItem.id, action: actionType, quantity: parseFloat(qty) || 1 }),
    })
    if (r.ok) {
      toast.success('Updated')
      setActionItem(null)
      load()
    } else {
      toast.error((await r.json()).error || 'Failed')
    }
  }

  const handleCardAction = (type, item) => {
    setActionType(type)
    setActionItem(item)
    setQty('1')
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  return (
    <div className="space-y-4">
      {metrics && !compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Value', val: inr(metrics.total_value), color: '#6366F1' },
            { label: 'Items', val: metrics.total_items, color: '#0D9488' },
            { label: 'Low Stock', val: metrics.low_stock_count, color: '#F59E0B' },
            { label: 'Critical', val: metrics.critical_stock_count, color: '#EF4444' },
            { label: 'Expiring', val: metrics.expiring_soon_count, color: '#8B5CF6' },
            { label: 'Health', val: `${metrics.inventory_health_pct}%`, color: '#22C55E' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.id ? 'bg-[#0D9488] text-white border-[#0D9488]' : 'border-border hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-40 text-sm"
          />
          <Button size="sm" variant="outline" onClick={load} aria-label="Refresh inventory"><Filter className="w-3.5 h-3.5" aria-hidden /></Button>
          <Button size="sm" asChild>
            <a href="/inventory/items"><Plus className="w-3.5 h-3.5 mr-1" />Add Item</a>
          </Button>
        </div>
      </div>

      {showAlerts && alerts && !compact && <StockAlertsPanel alerts={alerts} onRefresh={load} />}
      {showPurchases && !compact && <PurchasePanel onRefresh={load} />}

      <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
        {visible.map(item => (
          <InventoryItemCard
            key={item.id}
            item={item}
            compact={compact}
            onAction={handleCardAction}
          />
        ))}
        {!visible.length && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">No items match this filter.</p>
        )}
      </div>

      <Dialog open={!!actionItem} onOpenChange={o => !o && setActionItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType} — {actionItem?.item_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Quantity</Label>
              <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <Button onClick={runAction} className="w-full">Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
