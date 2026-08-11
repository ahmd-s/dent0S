'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export default function ReceptionInventoryDashboard() {
  const [purchases, setPurchases] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [pRes, sRes] = await Promise.all([
      fetch('/api/inventory/purchases'),
      fetch('/api/inventory/flow/stats'),
    ])
    const [pData, sData] = await Promise.all([pRes.json(), sRes.json()])
    setPurchases(pData.purchases || [])
    setMetrics(sData.metrics)
    setAlerts(sData.alerts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const purchaseAction = async (id, action) => {
    const r = await fetch(`/api/inventory/purchases/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (r.ok) { toast.success('Updated'); load() }
    else toast.error((await r.json()).error || 'Failed')
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>

  const pending = purchases.filter(p => ['requested', 'approved', 'ordered'].includes(p.status))
  const received = purchases.filter(p => p.status === 'received').slice(0, 5)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs text-muted-foreground">Purchase Requests</div>
          <div className="text-2xl font-bold">{metrics?.purchase_requests ?? 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs text-muted-foreground">Low Stock</div>
          <div className="text-2xl font-bold text-amber-600">{metrics?.low_stock_count ?? 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs text-muted-foreground">Pending Deliveries</div>
          <div className="text-2xl font-bold">{metrics?.pending_deliveries ?? 0}</div>
        </div>
        <div className="rounded-xl border p-3 bg-card">
          <div className="text-xs text-muted-foreground">Received This Month</div>
          <div className="text-2xl font-bold text-green-600">{metrics?.received_orders ?? 0}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Pending Purchase Orders</h3>
        {!pending.length && <p className="text-sm text-muted-foreground">No pending orders.</p>}
        <div className="space-y-2">
          {pending.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/50 pb-2">
              <div>
                <span className="font-medium capitalize">{p.status}</span>
                <span className="text-muted-foreground ml-2">{p.items?.length || 0} items · {inr(p.total_cost)}</span>
              </div>
              <div className="flex gap-1">
                {p.status === 'requested' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => purchaseAction(p.id, 'approve')}>Approve</Button>
                )}
                {p.status === 'approved' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => purchaseAction(p.id, 'order')}>Order</Button>
                )}
                {p.status === 'ordered' && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => purchaseAction(p.id, 'receive')}>
                    <CheckCircle2 className="w-3 h-3 mr-1" />Receive
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {alerts?.low_stock?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
          <p className="text-sm font-medium">Low stock items need reorder</p>
          <ul className="text-xs mt-1 space-y-0.5">
            {alerts.low_stock.slice(0, 8).map(i => (
              <li key={i.id}>{i.item_name} — {i.current_stock} left (min {i.minimum_stock})</li>
            ))}
          </ul>
        </div>
      )}

      {received.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">Recently Received</h3>
          {received.map(p => (
            <div key={p.id} className="text-xs text-muted-foreground">{p.received_at ? new Date(p.received_at).toLocaleDateString() : '—'} · {inr(p.total_cost)}</div>
          ))}
        </div>
      )}
    </div>
  )
}
