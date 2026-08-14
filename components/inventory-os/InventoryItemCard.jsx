'use client'

import { Package, Calendar, IndianRupee } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AsyncImage } from '@/components/ui/async-image'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export default function InventoryItemCard({ item, compact, onAction }) {
  const badge = item.status_badge || { label: item.status, className: 'bg-slate-100 text-slate-600' }

  return (
    <Card className={`overflow-hidden border-border bg-card hover:border-[#0D9488]/30 transition-colors ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex gap-3">
        <div className={`flex-shrink-0 rounded-lg bg-muted flex items-center justify-center ${compact ? 'w-12 h-12' : 'w-16 h-16'}`}>
          <AsyncImage
            src={item.image_url}
            className="w-full h-full object-cover rounded-lg"
            fallback={<Package className={`text-muted-foreground ${compact ? 'w-5 h-5' : 'w-7 h-7'}`} />}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={`font-semibold truncate ${compact ? 'text-sm' : 'text-base'}`}>{item.item_name}</h3>
              <p className="text-xs text-muted-foreground">{item.category}{item.vendor_name ? ` · ${item.vendor_name}` : ''}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {!compact && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 mt-3 text-xs">
              <div><span className="text-muted-foreground">Stock</span> <strong>{item.current_stock}</strong> {item.unit}</div>
              <div><span className="text-muted-foreground">Reserved</span> {item.reserved_stock || 0}</div>
              <div><span className="text-muted-foreground">Available</span> {item.available_stock}</div>
              <div><span className="text-muted-foreground">Min</span> {item.minimum_stock}</div>
              {item.batch_number && <div><span className="text-muted-foreground">Batch</span> {item.batch_number}</div>}
              {item.expiry_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  {item.days_remaining != null ? `${item.days_remaining}d left` : item.expiry_date.slice(0, 10)}
                </div>
              )}
              <div className="flex items-center gap-1">
                <IndianRupee className="w-3 h-3 text-muted-foreground" />
                {inr(item.current_value)}
              </div>
            </div>
          )}

          {compact && (
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span>Stock: <strong className="text-foreground">{item.current_stock}</strong></span>
              <span>Avail: {item.available_stock}</span>
            </div>
          )}

          {onAction && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction('receive', item)}>Stock In</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction('reserve', item)}>Reserve</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction('consume', item)}>Consume</Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
