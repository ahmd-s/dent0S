/**
 * Inventory helpers — stock status, FIFO, enrichment (Sprint 15).
 */

export const STOCK_STATUS = {
  HEALTHY: 'healthy',
  LOW: 'low_stock',
  CRITICAL: 'critical',
  EXPIRED: 'expired',
  OUT_OF_STOCK: 'out_of_stock',
}

export const CONSUMPTION_MOVEMENT_TYPES = new Set([
  'STOCK_OUT',
  'AUTO_CONSUMPTION',
  'STOCK_CONSUMED',
])

export const INFLOW_MOVEMENT_TYPES = new Set([
  'STOCK_IN',
  'STOCK_RECEIVED',
  'STOCK_RETURNED',
])

export const ITEM_FLOW_STATUSES = [
  'created',
  'purchased',
  'received',
  'available',
  'reserved',
  'consumed',
  'returned',
  'expired',
  'disposed',
  'archived',
]

export const PURCHASE_STATUSES = [
  'requested',
  'approved',
  'ordered',
  'received',
  'cancelled',
]

export const STATUS_BADGE = {
  healthy: { label: 'Healthy', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300' },
  low_stock: { label: 'Low Stock', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300' },
  critical: { label: 'Critical', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300' },
  expired: { label: 'Expired', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300' },
  out_of_stock: { label: 'Out of Stock', className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400' },
}

export function daysUntilExpiry(expiryDate) {
  if (!expiryDate) return null
  const exp = new Date(expiryDate)
  if (Number.isNaN(exp.getTime())) return null
  return Math.ceil((exp - new Date()) / 86400000)
}

export function computeAvailableStock(item) {
  const current = item?.current_stock || 0
  const reserved = item?.reserved_stock || 0
  return Math.max(0, current - reserved)
}

/** Derive stock health status from item fields. */
export function computeItemStatus(item) {
  if (!item || item.is_active === false) return STOCK_STATUS.OUT_OF_STOCK
  const stock = item.current_stock || 0
  const min = item.minimum_stock || 0
  const days = daysUntilExpiry(item.expiry_date)

  if (days != null && days < 0) return STOCK_STATUS.EXPIRED
  if (stock <= 0) return STOCK_STATUS.OUT_OF_STOCK
  if (min > 0 && stock <= min * 0.25) return STOCK_STATUS.CRITICAL
  if (min > 0 && stock <= min) return STOCK_STATUS.LOW
  return STOCK_STATUS.HEALTHY
}

export function getStatusBadge(status) {
  return STATUS_BADGE[status] || STATUS_BADGE.healthy
}

export function computeItemValue(item) {
  return (item?.current_stock || 0) * (item?.purchase_price || 0)
}

/** Sort batches FIFO — earliest expiry, then purchase date. */
export function sortBatchesFifo(batches = []) {
  return [...batches]
    .filter(b => (b.current_stock || 0) > 0 && b.status !== 'disposed' && b.status !== 'archived')
    .sort((a, b) => {
      const ea = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity
      const eb = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity
      if (ea !== eb) return ea - eb
      const pa = a.purchase_date ? new Date(a.purchase_date).getTime() : 0
      const pb = b.purchase_date ? new Date(b.purchase_date).getTime() : 0
      return pa - pb
    })
}

export function enrichItemFields(item, vendorMap = {}, movementMeta = {}) {
  const status = computeItemStatus(item)
  const daysRemaining = daysUntilExpiry(item.expiry_date)
  const available = computeAvailableStock(item)
  const vendor = item.vendor_id ? vendorMap[item.vendor_id] : null

  return {
    ...item,
    status,
    status_badge: getStatusBadge(status),
    available_stock: available,
    reserved_stock: item.reserved_stock || 0,
    current_value: computeItemValue(item),
    days_remaining: daysRemaining,
    vendor_name: vendor?.name || '',
    last_purchase: movementMeta.last_purchase || item.last_purchase_at || null,
    last_consumption: movementMeta.last_consumption || item.last_consumption_at || null,
  }
}
