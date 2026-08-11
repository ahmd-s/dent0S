'use client'

import Link from 'next/link'
import {
  Package,
  AlertTriangle,
  Clock,
  IndianRupee,
  TrendingDown,
  ShoppingCart,
  Truck,
  Activity,
  HeartPulse,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

function StatCard({ label, val, sub, icon: Icon, color, href }) {
  const inner = (
    <Card className={`p-3.5 bg-card border-border rounded-xl h-full ${href ? 'hover:border-[#0D9488]/40 cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color }}>{val}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
    </Card>
  )
  if (href) return <Link href={href} className="block h-full">{inner}</Link>
  return inner
}

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export function InventoryAlertsWidget({ stats }) {
  const low = stats?.inventory?.low_stock_count ?? stats?.inventory?.low_stock_count ?? 0
  const critical = stats?.inventory?.critical_stock_count ?? 0
  const total = low + critical
  return (
    <StatCard
      label="Inventory Alerts"
      val={total || '—'}
      sub={`${low} low · ${critical} critical`}
      icon={AlertTriangle}
      color="#F59E0B"
      href="/inventory/alerts"
    />
  )
}

export function InventoryValueWidget({ stats }) {
  return (
    <StatCard
      label="Inventory Value"
      val={stats?.inventory?.total_value != null ? inr(stats.inventory.total_value) : '—'}
      sub={`${stats?.inventory?.total_items ?? 0} items tracked`}
      icon={Package}
      color="#6366F1"
      href="/inventory"
    />
  )
}

export function LowStockWidget({ stats }) {
  return (
    <StatCard
      label="Low Stock"
      val={stats?.inventory?.low_stock_count ?? '—'}
      sub="Below minimum"
      icon={TrendingDown}
      color="#F59E0B"
      href="/inventory?status=low_stock"
    />
  )
}

export function CriticalStockWidget({ stats }) {
  return (
    <StatCard
      label="Critical Stock"
      val={stats?.inventory?.critical_stock_count ?? '—'}
      sub="Needs reorder"
      icon={AlertTriangle}
      color="#EF4444"
      href="/inventory?status=critical"
    />
  )
}

export function ExpiringSoonWidget({ stats }) {
  return (
    <StatCard
      label="Expiring Soon"
      val={stats?.inventory?.expiring_soon_count ?? '—'}
      sub="Within 90 days"
      icon={Clock}
      color="#8B5CF6"
      href="/inventory/alerts"
    />
  )
}

export function TodaysConsumptionWidget({ stats }) {
  return (
    <StatCard
      label="Today's Consumption"
      val={stats?.inventory?.today_consumption ?? '—'}
      sub="Units consumed"
      icon={Activity}
      color="#0D9488"
      href="/inventory/movements"
    />
  )
}

export function TopConsumedWidget({ stats }) {
  const top = stats?.inventory?.top_consumed?.[0]
  return (
    <StatCard
      label="Top Consumed"
      val={top?.total ?? '—'}
      sub={top?.item_name || 'This month'}
      icon={Package}
      color="#6366F1"
      href="/inventory"
    />
  )
}

export function PurchaseRequestsWidget({ stats }) {
  return (
    <StatCard
      label="Purchase Requests"
      val={stats?.inventory?.purchase_requests ?? stats?.inventory?.pending_purchases ?? '—'}
      sub="Awaiting action"
      icon={ShoppingCart}
      color="#F59E0B"
      href="/inventory"
    />
  )
}

export function VendorAlertsWidget({ stats }) {
  return (
    <StatCard
      label="Vendor Alerts"
      val={stats?.inventory?.pending_deliveries ?? '—'}
      sub="Pending deliveries"
      icon={Truck}
      color="#8B5CF6"
      href="/vendors"
    />
  )
}

export function StockMovementWidget({ stats }) {
  return (
    <StatCard
      label="Stock Movement"
      val={stats?.inventory?.monthly_consumption ?? '—'}
      sub="Units this month"
      icon={Activity}
      color="#0D9488"
      href="/inventory/movements"
    />
  )
}

export function MonthlySpendWidget({ stats }) {
  return (
    <StatCard
      label="Monthly Spend"
      val={stats?.inventory?.monthly_spend != null ? inr(stats.inventory.monthly_spend) : '—'}
      sub="Purchases received"
      icon={IndianRupee}
      color="#6366F1"
      href="/inventory"
    />
  )
}

export function InventoryHealthWidget({ stats }) {
  const pct = stats?.inventory?.inventory_health_pct
  return (
    <StatCard
      label="Inventory Health"
      val={pct != null ? `${pct}%` : '—'}
      sub="Healthy stock ratio"
      icon={HeartPulse}
      color={pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'}
      href="/inventory"
    />
  )
}

export const INVENTORY_FLOW_WIDGET_MAP = {
  inventory_alerts: InventoryAlertsWidget,
  inventory_value: InventoryValueWidget,
  low_stock: LowStockWidget,
  critical_stock: CriticalStockWidget,
  expiring_soon: ExpiringSoonWidget,
  todays_consumption: TodaysConsumptionWidget,
  top_consumed: TopConsumedWidget,
  purchase_requests: PurchaseRequestsWidget,
  vendor_alerts: VendorAlertsWidget,
  stock_movement: StockMovementWidget,
  monthly_spend: MonthlySpendWidget,
  inventory_health: InventoryHealthWidget,
}

export const INVENTORY_FLOW_STAT_WIDGET_IDS = new Set(Object.keys(INVENTORY_FLOW_WIDGET_MAP))
