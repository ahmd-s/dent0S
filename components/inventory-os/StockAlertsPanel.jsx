'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function StockAlertsPanel({ alerts, onRefresh }) {
  const sections = [
    { key: 'critical_stock', label: 'Critical', color: 'text-red-600' },
    { key: 'low_stock', label: 'Low Stock', color: 'text-amber-600' },
    { key: 'expiring_soon', label: 'Expiring Soon', color: 'text-purple-600' },
    { key: 'expired', label: 'Expired', color: 'text-red-500' },
    { key: 'fast_consumption', label: 'Fast Moving', color: 'text-teal-600' },
    { key: 'dead_inventory', label: 'Dead Stock', color: 'text-slate-500' },
  ]

  if (!alerts) return null

  const totalAlerts = sections.reduce((s, sec) => s + (alerts[sec.key]?.length || 0), 0)
  if (!totalAlerts) return null

  return (
    <div className="rounded-lg border border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold">Smart Alerts ({totalAlerts})</h3>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onRefresh}>Refresh</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {sections.map(sec => (
          <div key={sec.key} className="text-center p-2 rounded-md bg-card border border-border/50">
            <div className={`text-lg font-bold ${sec.color}`}>{alerts[sec.key]?.length || 0}</div>
            <div className="text-[10px] text-muted-foreground">{sec.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
