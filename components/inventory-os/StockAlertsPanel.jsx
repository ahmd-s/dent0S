'use client'

import { AlertTriangle } from 'lucide-react'

export default function StockAlertsPanel({ alerts }) {
  if (!alerts) return null

  const rows = [
    { key: 'critical_stock', label: 'Critical', tone: 'text-red-600' },
    { key: 'low_stock', label: 'Low stock', tone: 'text-amber-600' },
    { key: 'expiring_soon', label: 'Expiring', tone: 'text-amber-600' },
    { key: 'expired', label: 'Expired', tone: 'text-red-600' },
    { key: 'fast_consumption', label: 'Fast moving', tone: 'text-muted-foreground' },
    { key: 'dead_inventory', label: 'Unused', tone: 'text-muted-foreground' },
  ].map(sec => ({ ...sec, items: alerts[sec.key] || [] })).filter(sec => sec.items.length)

  if (!rows.length) return null

  return (
    <div className="rounded-xl border border-border/70 bg-card px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-medium">Needs attention</h3>
      </div>
      <div className="space-y-2">
        {rows.map(sec => (
          <p key={sec.key} className="text-sm">
            <span className={`font-medium ${sec.tone}`}>{sec.label}</span>
            <span className="text-muted-foreground"> · {sec.items.slice(0, 4).map(i => i.item_name).join(', ')}{sec.items.length > 4 ? ` +${sec.items.length - 4}` : ''}</span>
          </p>
        ))}
      </div>
    </div>
  )
}
