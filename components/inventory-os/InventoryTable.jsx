'use client'

import { useState } from 'react'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AsyncImage } from '@/components/ui/async-image'
import PrimaryActions from '@/components/ui/primary-actions'
import ScanTable, { ScanRow, ScanCell } from '@/components/ui/scan-table'

const COLUMNS = [
  { key: 'item', label: 'Item' },
  { key: 'stock', label: 'Stock', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: '', align: 'right', width: '1%' },
]

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

function ItemDetail({ item, open, onOpenChange, onAction, primaryAction }) {
  if (!item) return null
  const unit = item.unit || ''
  const badge = item.status_badge
  const run = (type) => {
    onOpenChange(false)
    onAction?.(type, item)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <div className="text-2xl font-semibold tabular-nums">
              {item.current_stock ?? 0} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
            </div>
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
            <Button size="sm" onClick={() => run(primaryAction)}>
              {primaryAction === 'receive' ? 'Stock In' : 'Consume'}
            </Button>
            {primaryAction !== 'receive' && (
              <Button size="sm" variant="outline" onClick={() => run('receive')}>Stock In</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => run('reserve')}>Reserve</Button>
            {primaryAction === 'receive' && (
              <Button size="sm" variant="outline" onClick={() => run('consume')}>Consume</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function InventoryTable({ items, onAction, primaryAction = 'consume', empty = 'No items match this filter.' }) {
  const [openItem, setOpenItem] = useState(null)

  if (!items?.length) {
    return <ScanTable columns={COLUMNS} empty={empty} />
  }

  return (
    <>
      <ScanTable columns={COLUMNS}>
        {items.map(item => {
          const problem = item.status && item.status !== 'healthy'
          const badge = item.status_badge
          const actions = onAction ? [
            { id: 'consume', label: 'Consume', onSelect: () => onAction('consume', item), primary: primaryAction === 'consume' },
            { id: 'receive', label: 'Stock In', onSelect: () => onAction('receive', item), primary: primaryAction === 'receive' },
            { id: 'reserve', label: 'Reserve', onSelect: () => onAction('reserve', item) },
          ] : []

          return (
            <ScanRow key={item.id} onClick={() => setOpenItem(item)}>
              <ScanCell>
                <div className="font-medium leading-snug">{item.item_name}</div>
                {item.category && <div className="text-xs text-muted-foreground mt-0.5">{item.category}</div>}
              </ScanCell>
              <ScanCell align="right" nowrap>
                <span className="text-base font-semibold tabular-nums">{item.current_stock ?? 0}</span>
                {item.unit && <span className="text-xs text-muted-foreground ml-1.5">{item.unit}</span>}
              </ScanCell>
              <ScanCell nowrap>
                {problem && badge ? (
                  <span className={`text-xs font-medium ${
                    ['expired', 'critical', 'out_of_stock'].includes(item.status) ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {badge.label}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </ScanCell>
              <ScanCell align="right" nowrap>
                {actions.length > 0 && (
                  <div onClick={e => e.stopPropagation()}>
                    <PrimaryActions actions={actions} quiet />
                  </div>
                )}
              </ScanCell>
            </ScanRow>
          )
        })}
      </ScanTable>
      <ItemDetail
        item={openItem}
        open={!!openItem}
        onOpenChange={o => !o && setOpenItem(null)}
        onAction={onAction}
        primaryAction={primaryAction}
      />
    </>
  )
}
