'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export default function PurchasePanel({ onRefresh }) {
  const [purchases, setPurchases] = useState([])
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/inventory/purchases?status=requested')
    const d = await r.json()
    setPurchases(d.purchases || [])
  }, [])

  useEffect(() => { load() }, [load])

  const approve = async (id) => {
    const r = await fetch(`/api/inventory/purchases/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (r.ok) { toast.success('Approved'); load(); onRefresh?.() }
    else toast.error((await r.json()).error || 'Failed')
  }

  if (!purchases.length && !expanded) return null

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Purchase Requests</h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>
      {(expanded || purchases.length <= 3) && (
        <div className="space-y-2">
          {purchases.slice(0, expanded ? 20 : 3).map(p => (
            <div key={p.id} className="flex justify-between items-center text-sm">
              <span>{p.items?.length || 0} items · {inr(p.total_cost)} · <span className="capitalize text-muted-foreground">{p.status}</span></span>
              {p.status === 'requested' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approve(p.id)}>Approve</Button>
              )}
            </div>
          ))}
          {!purchases.length && <p className="text-xs text-muted-foreground">No pending requests.</p>}
        </div>
      )}
      {!expanded && purchases.length > 3 && (
        <button type="button" className="text-xs text-[#0D9488] mt-1" onClick={() => setExpanded(true)}>
          +{purchases.length - 3} more
        </button>
      )}
    </div>
  )
}
