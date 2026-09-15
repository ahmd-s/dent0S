'use client'

import { useState } from 'react'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AsyncImage } from '@/components/ui/async-image'
import PrimaryActions from '@/components/ui/primary-actions'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

function DetailRow({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  )
}

export default function InventoryItemCard({ item, onAction, primaryAction = 'consume' }) {
  const [open, setOpen] = useState(false)
  const problem = item.status && item.status !== 'healthy'
  const badge = item.status_badge
  const unit = item.unit || ''

  const run = (type) => {
    onAction?.(type, item)
  }

  const actions = onAction ? [
    { id: 'consume', label: 'Consume', onSelect: () => run('consume'), primary: primaryAction === 'consume' },
    { id: 'receive', label: 'Stock In', onSelect: () => run('receive'), primary: primaryAction === 'receive' },
    { id: 'reserve', label: 'Reserve', onSelect: () => run('reserve') },
  ] : []

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card hover:border-border hover:bg-muted/20 transition-colors">
        <button type="button" className="w-full text-left px-5 py-4" onClick={() => setOpen(true)}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-foreground truncate leading-snug">{item.item_name}</h3>
            {problem && badge && (
              <span className={`text-[11px] font-medium shrink-0 rounded-md px-2 py-0.5 ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{item.current_stock ?? 0}</span>
            <span className="text-sm text-muted-foreground">{unit || 'in stock'}</span>
          </div>
        </button>
        {actions.length > 0 && (
          <div className="px-5 pb-3.5">
            <PrimaryActions actions={actions} />
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-6">{item.item_name}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              <AsyncImage
                src={item.image_url}
                className="w-full h-full object-cover rounded-lg"
                fallback={<Package className="w-6 h-6 text-muted-foreground" />}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-2xl font-semibold tabular-nums">{item.current_stock ?? 0} <span className="text-sm font-normal text-muted-foreground">{unit}</span></div>
              {badge && (
                <span className={`inline-flex mt-1.5 text-[11px] font-medium rounded-md px-2 py-0.5 ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>
          </div>
          <div className="mt-1">
            <DetailRow label="Category" value={item.category} />
            <DetailRow label="Supplier" value={item.vendor_name} />
            <DetailRow label="Available" value={item.available_stock} />
            <DetailRow label="Reserved" value={item.reserved_stock || 0} />
            <DetailRow label="Minimum" value={item.minimum_stock} />
            <DetailRow label="Batch" value={item.batch_number} />
            <DetailRow
              label="Expiry"
              value={item.expiry_date
                ? (item.days_remaining != null ? `${item.expiry_date.slice(0, 10)} · ${item.days_remaining}d` : item.expiry_date.slice(0, 10))
                : null}
            />
            <DetailRow label="Value" value={inr(item.current_value)} />
          </div>
          {onAction && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => { setOpen(false); run(primaryAction) }}>
                {primaryAction === 'receive' ? 'Stock In' : 'Consume'}
              </Button>
              {primaryAction !== 'receive' && (
                <Button size="sm" variant="outline" onClick={() => { setOpen(false); run('receive') }}>Stock In</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { setOpen(false); run('reserve') }}>Reserve</Button>
              {primaryAction === 'receive' && (
                <Button size="sm" variant="outline" onClick={() => { setOpen(false); run('consume') }}>Consume</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
