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
  { id: 'healthy', label: 'In stock' },
  { id: 'low_stock', label: 'Low' },
  { id: 'critical', label: 'Critical' },
  { id: 'expired', label: 'Expired' },
  { id: 'out_of_stock', label: 'Out' },
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
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-4">
      {metrics && !compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Items', val: metrics.total_items },
            { label: 'Stock value', val: inr(metrics.total_value) },
            { label: 'Low stock', val: metrics.low_stock_count, alert: metrics.low_stock_count > 0 },
            { label: 'Critical', val: (metrics.critical_stock_count || 0) + (metrics.expired_count || 0), alert: ((metrics.critical_stock_count || 0) + (metrics.expired_count || 0)) > 0 },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border/70 bg-card px-5 py-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-semibold tabular-nums mt-1 ${s.alert ? 'text-amber-600' : 'text-foreground'}`}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex bg-muted/70 rounded-lg p-0.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                filter === f.id ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
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

      <div className={`grid gap-4 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
        {visible.map(item => (
          <InventoryItemCard
            key={item.id}
            item={item}
            onAction={handleCardAction}
            primaryAction="receive"
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
