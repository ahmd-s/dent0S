/**
 * Inventory Workflow Engine — stock lifecycle, batches, purchases, metrics (Sprint 15).
 */

import { v4 as uuidv4 } from 'uuid'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import {
  computeItemStatus,
  computeAvailableStock,
  enrichItemFields,
  sortBatchesFifo,
  CONSUMPTION_MOVEMENT_TYPES,
  INFLOW_MOVEMENT_TYPES,
  daysUntilExpiry,
  STOCK_STATUS,
} from '@/lib/inventory-helpers'
import {
  logInventoryFlowChange,
  logInventoryStockEvent,
  logPurchaseStatusChange,
  logInventoryAlert,
} from '@/lib/inventory-activity'

export class InventoryFlowError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

async function getItem(db, clinicId, id) {
  return db.collection('inventory_items').findOne({ id, clinic_id: clinicId, is_active: { $ne: false } })
}

async function recordMovement(db, profile, item, movement) {
  const id = uuidv4()
  await db.collection('stock_movements').insertOne({
    id,
    clinic_id: profile.clinic_id,
    item_id: item.id,
    item_name: item.item_name,
    created_by: profile.id,
    created_at: new Date(),
    ...movement,
  })
  return id
}

/** Create or update batch on stock-in. */
export async function receiveStockBatch(db, profile, item, {
  quantity,
  batch_number,
  expiry_date,
  purchase_date,
  vendor_id,
  purchase_cost,
  invoice_number,
  reason = 'Purchase',
  notes = '',
}) {
  if (!quantity || quantity <= 0) throw new InventoryFlowError('Quantity must be positive')

  const now = new Date()
  const stockBefore = item.current_stock || 0
  const stockAfter = stockBefore + quantity
  const batchId = uuidv4()

  await db.collection('inventory_batches').insertOne({
    id: batchId,
    clinic_id: profile.clinic_id,
    item_id: item.id,
    batch_number: batch_number || `BATCH-${Date.now()}`,
    purchase_date: purchase_date || now.toISOString().slice(0, 10),
    expiry_date: expiry_date || null,
    quantity_received: quantity,
    current_stock: quantity,
    supplier_id: vendor_id || item.vendor_id || null,
    purchase_cost: purchase_cost || item.purchase_price || 0,
    current_cost: purchase_cost || item.purchase_price || 0,
    invoice_number: invoice_number || null,
    status: 'available',
    received_by: profile.full_name || profile.id,
    created_at: now,
    updated_at: now,
  })

  await recordMovement(db, profile, item, {
    movement_type: 'STOCK_RECEIVED',
    quantity,
    direction: 'in',
    stock_before: stockBefore,
    stock_after: stockAfter,
    reason,
    vendor_id: vendor_id || null,
    purchase_cost: purchase_cost || null,
    invoice_number: invoice_number || null,
    batch_id: batchId,
    notes,
  })

  const itemUpdate = {
    current_stock: stockAfter,
    flow_status: 'available',
    last_purchase_at: now,
    updated_at: now,
  }
  if (expiry_date) itemUpdate.expiry_date = expiry_date
  if (batch_number) itemUpdate.batch_number = batch_number
  if (purchase_cost != null) itemUpdate.purchase_price = purchase_cost

  await db.collection('inventory_items').updateOne(
    { id: item.id, clinic_id: profile.clinic_id },
    { $set: itemUpdate }
  )

  await logInventoryStockEvent(db, profile, ACTIVITY_EVENTS.STOCK_RECEIVED, item, {
    quantity,
    batch_id: batchId,
    stock_after: stockAfter,
  })
  await logInventoryFlowChange(db, profile, item, 'received', { quantity, batch_id: batchId })

  const newStatus = computeItemStatus({ ...item, ...itemUpdate })
  if (newStatus === STOCK_STATUS.LOW || newStatus === STOCK_STATUS.CRITICAL) {
    await logInventoryAlert(db, profile,
      newStatus === STOCK_STATUS.CRITICAL ? ACTIVITY_EVENTS.CRITICAL_STOCK : ACTIVITY_EVENTS.LOW_STOCK,
      { item_id: item.id, item_name: item.item_name, current_stock: stockAfter }
    )
  }

  return { stock_after: stockAfter, batch_id: batchId }
}

/** FIFO consumption from batches. */
export async function consumeStockFifo(db, profile, item, quantity, meta = {}) {
  if (!quantity || quantity <= 0) throw new InventoryFlowError('Quantity must be positive')

  const batches = await db.collection('inventory_batches')
    .find({ clinic_id: profile.clinic_id, item_id: item.id })
    .toArray()

  let remaining = quantity
  const consumedBatches = []
  for (const batch of sortBatchesFifo(batches)) {
    if (remaining <= 0) break
    const take = Math.min(batch.current_stock || 0, remaining)
    if (take <= 0) continue
    const newBatchStock = (batch.current_stock || 0) - take
    await db.collection('inventory_batches').updateOne(
      { id: batch.id },
      { $set: { current_stock: newBatchStock, updated_at: new Date(), status: newBatchStock <= 0 ? 'consumed' : batch.status } }
    )
    consumedBatches.push({ batch_id: batch.id, batch_number: batch.batch_number, quantity: take })
    remaining -= take
  }

  const stockBefore = item.current_stock || 0
  const stockAfter = Math.max(0, stockBefore - quantity)
  const movementType = meta.auto ? 'AUTO_CONSUMPTION' : 'STOCK_CONSUMED'

  await recordMovement(db, profile, item, {
    movement_type: movementType,
    quantity,
    direction: 'out',
    stock_before: stockBefore,
    stock_after: stockAfter,
    reason: meta.reason || 'Treatment Consumption',
    visit_id: meta.visit_id || null,
    patient_name: meta.patient_name || null,
    patient_id: meta.patient_id || null,
    appointment_id: meta.appointment_id || null,
    treatment_name: meta.treatment_name || null,
    purchase_cost: item.purchase_price || null,
    notes: meta.notes || '',
    batches: consumedBatches,
  })

  const reserved = Math.max(0, (item.reserved_stock || 0) - Math.min(item.reserved_stock || 0, quantity))
  await db.collection('inventory_items').updateOne(
    { id: item.id, clinic_id: profile.clinic_id },
    {
      $set: {
        current_stock: stockAfter,
        reserved_stock: reserved,
        flow_status: stockAfter <= 0 ? 'consumed' : 'available',
        last_consumption_at: new Date(),
        updated_at: new Date(),
      },
    }
  )

  await logInventoryStockEvent(db, profile, ACTIVITY_EVENTS.STOCK_CONSUMED, item, {
    quantity,
    stock_after: stockAfter,
    ...meta,
  })

  const updated = { ...item, current_stock: stockAfter }
  const status = computeItemStatus(updated)
  if (status === STOCK_STATUS.LOW) {
    await logInventoryAlert(db, profile, ACTIVITY_EVENTS.LOW_STOCK, { item_id: item.id, item_name: item.item_name, current_stock: stockAfter })
  } else if (status === STOCK_STATUS.CRITICAL || status === STOCK_STATUS.OUT_OF_STOCK) {
    await logInventoryAlert(db, profile, ACTIVITY_EVENTS.CRITICAL_STOCK, { item_id: item.id, item_name: item.item_name, current_stock: stockAfter })
  }

  return { stock_before: stockBefore, stock_after: stockAfter, consumed_batches: consumedBatches, warnings: remaining > 0 ? [`Short by ${remaining} units`] : [] }
}

export async function reserveStock(db, profile, item, quantity, meta = {}) {
  const available = computeAvailableStock(item)
  if (quantity > available) throw new InventoryFlowError(`Insufficient available stock (${available})`)

  const reserved = (item.reserved_stock || 0) + quantity
  await db.collection('inventory_items').updateOne(
    { id: item.id, clinic_id: profile.clinic_id },
    { $set: { reserved_stock: reserved, flow_status: 'reserved', updated_at: new Date() } }
  )

  await recordMovement(db, profile, item, {
    movement_type: 'STOCK_RESERVED',
    quantity,
    direction: 'reserve',
    stock_before: item.current_stock,
    stock_after: item.current_stock,
    reason: meta.reason || 'Reserved',
    appointment_id: meta.appointment_id || null,
    visit_id: meta.visit_id || null,
    notes: meta.notes || '',
  })

  await logInventoryStockEvent(db, profile, ACTIVITY_EVENTS.STOCK_RESERVED, item, { quantity, reserved_total: reserved })
  return { reserved_stock: reserved, available_stock: available - quantity }
}

export async function releaseReservedStock(db, profile, item, quantity, meta = {}) {
  const release = Math.min(quantity, item.reserved_stock || 0)
  const reserved = Math.max(0, (item.reserved_stock || 0) - release)

  await db.collection('inventory_items').updateOne(
    { id: item.id, clinic_id: profile.clinic_id },
    { $set: { reserved_stock: reserved, flow_status: reserved > 0 ? 'reserved' : 'available', updated_at: new Date() } }
  )

  await recordMovement(db, profile, item, {
    movement_type: 'STOCK_RELEASED',
    quantity: release,
    direction: 'release',
    stock_before: item.current_stock,
    stock_after: item.current_stock,
    reason: meta.reason || 'Released',
    notes: meta.notes || '',
  })

  await logInventoryStockEvent(db, profile, ACTIVITY_EVENTS.STOCK_RELEASED, item, { quantity: release, reserved_total: reserved })
  return { reserved_stock: reserved }
}

export async function disposeItem(db, profile, item, { quantity, reason = 'Expired/Disposed', notes = '' } = {}) {
  const qty = quantity || item.current_stock || 0
  if (qty <= 0) throw new InventoryFlowError('Nothing to dispose')

  const stockBefore = item.current_stock || 0
  const stockAfter = Math.max(0, stockBefore - qty)

  await recordMovement(db, profile, item, {
    movement_type: 'STOCK_DISPOSED',
    quantity: qty,
    direction: 'out',
    stock_before: stockBefore,
    stock_after: stockAfter,
    reason,
    notes,
  })

  await db.collection('inventory_items').updateOne(
    { id: item.id, clinic_id: profile.clinic_id },
    { $set: { current_stock: stockAfter, flow_status: 'disposed', updated_at: new Date() } }
  )

  await logInventoryStockEvent(db, profile, ACTIVITY_EVENTS.ITEM_DISPOSED, item, { quantity: qty, reason })
  await logInventoryFlowChange(db, profile, item, 'disposed', { quantity: qty, reason })

  if (reason.toLowerCase().includes('expir')) {
    await logInventoryAlert(db, profile, ACTIVITY_EVENTS.ITEM_EXPIRED, { item_id: item.id, item_name: item.item_name })
  }

  return { stock_after: stockAfter }
}

/** Apply treatment template consumption automatically. */
export async function applyTreatmentConsumption(db, profile, { treatment_name, visit_id, patient_id, patient_name, appointment_id }) {
  if (!treatment_name) return { consumed: [], warnings: [] }

  const template = await db.collection('treatment_templates').findOne({
    clinic_id: profile.clinic_id,
    treatment_name: { $regex: new RegExp(`^${treatment_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  })
  if (!template?.items?.length) return { consumed: [], warnings: [], skipped: true }

  const consumed = []
  const warnings = []
  for (const ti of template.items) {
    const item = await getItem(db, profile.clinic_id, ti.item_id)
    if (!item) {
      warnings.push({ item_id: ti.item_id, message: 'Item not found' })
      continue
    }
    const qty = ti.suggested_quantity || 1
    const result = await consumeStockFifo(db, profile, item, qty, {
      auto: true,
      visit_id,
      patient_id,
      patient_name,
      appointment_id,
      treatment_name,
      reason: `Auto: ${treatment_name}`,
    })
    consumed.push({ item_id: item.id, item_name: item.item_name, quantity: qty, ...result })
    warnings.push(...(result.warnings || []).map(w => ({ item_id: item.id, item_name: item.item_name, message: w })))
  }
  return { consumed, warnings }
}

export async function executeInventoryFlowAction(db, profile, itemId, action, payload = {}) {
  const item = await getItem(db, profile.clinic_id, itemId)
  if (!item) throw new InventoryFlowError('Item not found', 404)

  switch (action) {
    case 'receive':
      return receiveStockBatch(db, profile, item, payload)
    case 'consume':
      return consumeStockFifo(db, profile, item, payload.quantity, payload)
    case 'reserve':
      return reserveStock(db, profile, item, payload.quantity, payload)
    case 'release':
      return releaseReservedStock(db, profile, item, payload.quantity, payload)
    case 'dispose':
      return disposeItem(db, profile, item, payload)
    case 'mark_expired':
      return disposeItem(db, profile, item, { ...payload, reason: 'Expired' })
    case 'archive': {
      await db.collection('inventory_items').updateOne(
        { id: item.id, clinic_id: profile.clinic_id },
        { $set: { is_active: false, flow_status: 'archived', updated_at: new Date() } }
      )
      await logInventoryFlowChange(db, profile, item, 'archived', payload)
      return { archived: true }
    }
    default:
      throw new InventoryFlowError(`Unknown action: ${action}`)
  }
}

/** Purchase workflow */
export async function createPurchaseRequest(db, profile, data) {
  const id = uuidv4()
  const now = new Date()
  const doc = {
    id,
    clinic_id: profile.clinic_id,
    vendor_id: data.vendor_id || null,
    items: data.items || [],
    status: 'requested',
    invoice_number: data.invoice_number || null,
    total_cost: data.total_cost || 0,
    expected_delivery: data.expected_delivery || null,
    notes: data.notes || '',
    requested_by: profile.id,
    requested_by_name: profile.full_name || '',
    created_at: now,
    updated_at: now,
  }
  await db.collection('inventory_purchases').insertOne(doc)
  await logPurchaseStatusChange(db, profile, doc, 'requested')
  return doc
}

export async function executePurchaseAction(db, profile, purchaseId, action, payload = {}) {
  const purchase = await db.collection('inventory_purchases').findOne({
    id: purchaseId,
    clinic_id: profile.clinic_id,
  })
  if (!purchase) throw new InventoryFlowError('Purchase not found', 404)

  const now = new Date()
  const transitions = {
    approve: 'approved',
    order: 'ordered',
    receive: 'received',
    cancel: 'cancelled',
  }
  const newStatus = transitions[action]
  if (!newStatus) throw new InventoryFlowError(`Unknown purchase action: ${action}`)

  const update = { status: newStatus, updated_at: now }
  if (action === 'approve') {
    update.approved_by = profile.id
    update.approved_at = now
  }
  if (action === 'order') update.ordered_at = now
  if (action === 'receive') {
    update.received_by = profile.full_name || profile.id
    update.received_at = now
    for (const line of purchase.items || []) {
      const item = await getItem(db, profile.clinic_id, line.item_id)
      if (!item) continue
      await receiveStockBatch(db, profile, item, {
        quantity: line.quantity,
        vendor_id: purchase.vendor_id,
        purchase_cost: line.purchase_cost,
        invoice_number: purchase.invoice_number,
        batch_number: line.batch_number,
        expiry_date: line.expiry_date,
      })
    }
  }

  await db.collection('inventory_purchases').updateOne({ id: purchaseId }, { $set: update })
  await logPurchaseStatusChange(db, profile, { ...purchase, ...update }, newStatus, payload)
  return { ...purchase, ...update }
}

async function getMovementMeta(db, clinicId, itemIds) {
  if (!itemIds.length) return {}
  const movements = await db.collection('stock_movements').aggregate([
    { $match: { clinic_id: clinicId, item_id: { $in: itemIds } } },
    { $sort: { created_at: -1 } },
    {
      $group: {
        _id: '$item_id',
        last_purchase: {
          $max: {
            $cond: [{ $in: ['$movement_type', ['STOCK_IN', 'STOCK_RECEIVED']] }, '$created_at', null],
          },
        },
        last_consumption: {
          $max: {
            $cond: [{ $in: ['$movement_type', ['STOCK_OUT', 'AUTO_CONSUMPTION', 'STOCK_CONSUMED']] }, '$created_at', null],
          },
        },
      },
    },
  ]).toArray()

  return Object.fromEntries(movements.map(m => [m._id, { last_purchase: m.last_purchase, last_consumption: m.last_consumption }]))
}

export async function getEnrichedInventoryItems(db, clinicId, filter = {}) {
  const f = { clinic_id: clinicId, is_active: { $ne: false }, ...filter }
  const [items, vendors] = await Promise.all([
    db.collection('inventory_items').find(f).sort({ item_name: 1 }).toArray(),
    db.collection('vendors').find({ clinic_id: clinicId, is_archived: { $ne: true } }).toArray(),
  ])
  const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v]))
  const meta = await getMovementMeta(db, clinicId, items.map(i => i.id))
  return items.map(item => enrichItemFields(item, vendorMap, meta[item.id] || {}))
}

/** Smart alerts detection */
export async function computeInventoryAlerts(db, clinicId) {
  const items = await getEnrichedInventoryItems(db, clinicId)
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  const movements = await db.collection('stock_movements').find({
    clinic_id: clinicId,
    created_at: { $gte: monthAgo },
  }).toArray()

  const consumptionByItem = {}
  for (const m of movements) {
    if (!CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type)) continue
    consumptionByItem[m.item_id] = (consumptionByItem[m.item_id] || 0) + (m.quantity || 0)
  }

  const alerts = {
    low_stock: [],
    critical_stock: [],
    expired: [],
    expiring_soon: [],
    fast_consumption: [],
    unused_stock: [],
    dead_inventory: [],
    high_cost: [],
    duplicate_purchases: [],
  }

  for (const item of items) {
    if (item.status === STOCK_STATUS.LOW) alerts.low_stock.push(item)
    if (item.status === STOCK_STATUS.CRITICAL || item.status === STOCK_STATUS.OUT_OF_STOCK) alerts.critical_stock.push(item)
    if (item.status === STOCK_STATUS.EXPIRED) alerts.expired.push(item)
    if (item.days_remaining != null && item.days_remaining >= 0 && item.days_remaining <= 90) alerts.expiring_soon.push(item)
    if ((consumptionByItem[item.id] || 0) > (item.minimum_stock || 1) * 3) alerts.fast_consumption.push(item)
    if ((item.current_stock || 0) > 0 && !consumptionByItem[item.id]) alerts.unused_stock.push(item)
    if ((item.current_stock || 0) > 0 && !consumptionByItem[item.id] && (item.current_value || 0) > 5000) alerts.dead_inventory.push(item)
    if ((item.purchase_price || 0) * (item.current_stock || 0) > 10000) alerts.high_cost.push(item)
  }

  const recentPurchases = await db.collection('inventory_purchases').find({
    clinic_id: clinicId,
    created_at: { $gte: monthAgo },
    status: { $ne: 'cancelled' },
  }).toArray()
  const purchaseKeys = {}
  for (const p of recentPurchases) {
    for (const line of p.items || []) {
      const key = `${line.item_id}-${p.vendor_id}`
      if (purchaseKeys[key]) alerts.duplicate_purchases.push({ ...p, duplicate_of: purchaseKeys[key] })
      else purchaseKeys[key] = p.id
    }
  }

  return alerts
}

/** Dashboard / widget metrics */
export async function computeInventoryMetrics(db, clinicId) {
  const items = await getEnrichedInventoryItems(db, clinicId)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [todayMovements, monthMovements, purchases, batches] = await Promise.all([
    db.collection('stock_movements').find({ clinic_id: clinicId, created_at: { $gte: todayStart } }).toArray(),
    db.collection('stock_movements').find({ clinic_id: clinicId, created_at: { $gte: monthStart } }).toArray(),
    db.collection('inventory_purchases').find({ clinic_id: clinicId }).toArray(),
    db.collection('inventory_batches').find({ clinic_id: clinicId }).toArray(),
  ])

  const totalValue = items.reduce((s, i) => s + (i.current_value || 0), 0)
  const lowStock = items.filter(i => i.status === STOCK_STATUS.LOW).length
  const criticalStock = items.filter(i => [STOCK_STATUS.CRITICAL, STOCK_STATUS.OUT_OF_STOCK].includes(i.status)).length
  const expiringSoon = items.filter(i => i.days_remaining != null && i.days_remaining >= 0 && i.days_remaining <= 90).length
  const expired = items.filter(i => i.status === STOCK_STATUS.EXPIRED).length

  const todayConsumption = todayMovements
    .filter(m => CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type))
    .reduce((s, m) => s + (m.quantity || 0), 0)

  const monthlyConsumption = monthMovements
    .filter(m => CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type))
    .reduce((s, m) => s + (m.quantity || 0), 0)

  const consumptionByItem = {}
  for (const m of monthMovements) {
    if (!CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type)) continue
    if (!consumptionByItem[m.item_id]) consumptionByItem[m.item_id] = { item_name: m.item_name, total: 0 }
    consumptionByItem[m.item_id].total += m.quantity || 0
  }
  const topConsumed = Object.values(consumptionByItem).sort((a, b) => b.total - a.total).slice(0, 5)

  const pendingPurchases = purchases.filter(p => ['requested', 'approved', 'ordered'].includes(p.status))
  const monthlySpend = purchases
    .filter(p => p.status === 'received' && p.received_at && new Date(p.received_at) >= monthStart)
    .reduce((s, p) => s + (p.total_cost || 0), 0)

  const healthScore = items.length
    ? Math.round((items.filter(i => i.status === STOCK_STATUS.HEALTHY).length / items.length) * 100)
    : 100

  const expiryLoss = batches
    .filter(b => b.expiry_date && daysUntilExpiry(b.expiry_date) != null && daysUntilExpiry(b.expiry_date) < 0)
    .reduce((s, b) => s + ((b.current_stock || 0) * (b.current_cost || 0)), 0)

  return {
    total_items: items.length,
    total_value: totalValue,
    low_stock_count: lowStock,
    critical_stock_count: criticalStock,
    expiring_soon_count: expiringSoon,
    expired_count: expired,
    today_consumption: todayConsumption,
    monthly_consumption: monthlyConsumption,
    top_consumed: topConsumed,
    pending_purchases: pendingPurchases.length,
    monthly_spend: monthlySpend,
    inventory_health_pct: healthScore,
    expiry_loss: expiryLoss,
    fast_moving: topConsumed.slice(0, 3),
    slow_moving: items.filter(i => (i.current_stock || 0) > 0 && !consumptionByItem[i.id]).slice(0, 5).map(i => ({ item_name: i.item_name, current_stock: i.current_stock })),
    purchase_requests: pendingPurchases.filter(p => p.status === 'requested').length,
    received_orders: purchases.filter(p => p.status === 'received' && p.received_at && new Date(p.received_at) >= monthStart).length,
    pending_deliveries: pendingPurchases.filter(p => p.status === 'ordered').length,
  }
}

/**
 * Lightweight inventory metrics for dashboard widgets.
 * Skips vendor enrichment and full movement history aggregation.
 */
export async function computeInventoryMetricsLite(db, clinicId) {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [items, todayMovements, monthMovements, pendingPurchases, monthlySpendAgg, purchaseRequests, pendingDeliveries] = await Promise.all([
    db.collection('inventory_items').find(
      { clinic_id: clinicId, is_active: { $ne: false } },
      {
        projection: {
          _id: 0,
          id: 1,
          item_name: 1,
          current_stock: 1,
          reserved_stock: 1,
          minimum_stock: 1,
          expiry_date: 1,
          purchase_price: 1,
          is_active: 1,
        },
      }
    ).toArray(),
    db.collection('stock_movements').find(
      { clinic_id: clinicId, created_at: { $gte: todayStart } },
      { projection: { _id: 0, movement_type: 1, quantity: 1, item_id: 1, item_name: 1 } }
    ).toArray(),
    db.collection('stock_movements').find(
      { clinic_id: clinicId, created_at: { $gte: monthStart } },
      { projection: { _id: 0, movement_type: 1, quantity: 1, item_id: 1, item_name: 1 } }
    ).toArray(),
    db.collection('inventory_purchases').countDocuments({
      clinic_id: clinicId,
      status: { $in: ['requested', 'approved', 'ordered'] },
    }),
    db.collection('inventory_purchases').aggregate([
      {
        $match: {
          clinic_id: clinicId,
          status: 'received',
          received_at: { $gte: monthStart },
        },
      },
      { $group: { _id: null, total: { $sum: '$total_cost' }, count: { $sum: 1 } } },
    ]).toArray(),
    db.collection('inventory_purchases').countDocuments({
      clinic_id: clinicId,
      status: 'requested',
    }),
    db.collection('inventory_purchases').countDocuments({
      clinic_id: clinicId,
      status: 'ordered',
    }),
  ])

  const enriched = items.map(item => enrichItemFields(item))
  const lowStock = enriched.filter(i => i.status === STOCK_STATUS.LOW).length
  const criticalStock = enriched.filter(i => [STOCK_STATUS.CRITICAL, STOCK_STATUS.OUT_OF_STOCK].includes(i.status)).length
  const expiringSoon = enriched.filter(i => i.days_remaining != null && i.days_remaining >= 0 && i.days_remaining <= 90).length
  const expired = enriched.filter(i => i.status === STOCK_STATUS.EXPIRED).length
  const totalValue = enriched.reduce((s, i) => s + (i.current_value || 0), 0)

  const todayConsumption = todayMovements
    .filter(m => CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type))
    .reduce((s, m) => s + (m.quantity || 0), 0)
  const monthlyConsumption = monthMovements
    .filter(m => CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type))
    .reduce((s, m) => s + (m.quantity || 0), 0)

  const consumptionByItem = {}
  for (const m of monthMovements) {
    if (!CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type)) continue
    if (!consumptionByItem[m.item_id]) consumptionByItem[m.item_id] = { item_name: m.item_name, total: 0 }
    consumptionByItem[m.item_id].total += m.quantity || 0
  }
  const topConsumed = Object.values(consumptionByItem).sort((a, b) => b.total - a.total).slice(0, 5)

  const healthScore = enriched.length
    ? Math.round((enriched.filter(i => i.status === STOCK_STATUS.HEALTHY).length / enriched.length) * 100)
    : 100

  return {
    total_items: enriched.length,
    total_value: totalValue,
    low_stock_count: lowStock,
    critical_stock_count: criticalStock,
    expiring_soon_count: expiringSoon,
    expired_count: expired,
    today_consumption: todayConsumption,
    monthly_consumption: monthlyConsumption,
    top_consumed: topConsumed,
    pending_purchases: pendingPurchases,
    monthly_spend: monthlySpendAgg[0]?.total || 0,
    inventory_health_pct: healthScore,
    expiry_loss: 0,
    fast_moving: topConsumed.slice(0, 3),
    slow_moving: enriched
      .filter(i => (i.current_stock || 0) > 0 && !consumptionByItem[i.id])
      .slice(0, 5)
      .map(i => ({ item_name: i.item_name, current_stock: i.current_stock })),
    purchase_requests: purchaseRequests,
    received_orders: monthlySpendAgg[0]?.count || 0,
    pending_deliveries: pendingDeliveries,
  }
}

/** Supplier vendor intelligence (extends lab vendor dashboard pattern) */
export async function buildSupplierInventoryDashboard(db, clinicId, vendorId) {
  const vendor = await db.collection('vendors').findOne({ id: vendorId, clinic_id: clinicId })
  if (!vendor) return null

  const [purchases, movements, items] = await Promise.all([
    db.collection('inventory_purchases').find({ clinic_id: clinicId, vendor_id: vendorId }).toArray(),
    db.collection('stock_movements').find({ clinic_id: clinicId, vendor_id: vendorId }).toArray(),
    db.collection('inventory_items').find({ clinic_id: clinicId, vendor_id: vendorId }).toArray(),
  ])

  const received = purchases.filter(p => p.status === 'received')
  const totalSpend = received.reduce((s, p) => s + (p.total_cost || 0), 0)
  const lateDeliveries = received.filter(p =>
    p.expected_delivery && p.received_at &&
    new Date(p.received_at) > new Date(p.expected_delivery + 'T23:59:59')
  ).length

  const deliveryDays = received
    .filter(p => p.ordered_at && p.received_at)
    .map(p => Math.round((new Date(p.received_at) - new Date(p.ordered_at)) / 86400000))
  const avgDeliveryDays = deliveryDays.length
    ? Math.round(deliveryDays.reduce((s, d) => s + d, 0) / deliveryDays.length)
    : null

  const itemCounts = {}
  for (const m of movements.filter(m => INFLOW_MOVEMENT_TYPES.has(m.movement_type))) {
    itemCounts[m.item_id] = (itemCounts[m.item_id] || 0) + (m.quantity || 0)
  }
  const mostPurchased = Object.entries(itemCounts)
    .map(([id, qty]) => ({ item_name: items.find(i => i.id === id)?.item_name || id, quantity: qty }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))]

  return {
    vendor: { id: vendor.id, name: vendor.name, contact_person: vendor.contact_person, phone: vendor.phone },
    purchase_volume: purchases.length,
    total_spend: totalSpend,
    average_delivery_days: avgDeliveryDays,
    late_deliveries: lateDeliveries,
    material_categories: categories,
    quality_score: vendor.rating || (lateDeliveries === 0 && received.length > 0 ? 4.5 : 3.5),
    last_purchase: received.sort((a, b) => new Date(b.received_at) - new Date(a.received_at))[0]?.received_at || null,
    most_purchased_items: mostPurchased,
    pending_orders: purchases.filter(p => ['requested', 'approved', 'ordered'].includes(p.status)).length,
  }
}

/** Patient inventory consumption summary */
export async function getPatientInventoryUsage(db, clinicId, patientId) {
  const visits = await db.collection('visits').find({ clinic_id: clinicId, patient_id: patientId }).project({ id: 1 }).toArray()
  const visitIds = visits.map(v => v.id)

  const movements = await db.collection('stock_movements').find({
    clinic_id: clinicId,
    $or: [
      { patient_id: patientId },
      { visit_id: { $in: visitIds } },
    ],
  }).sort({ created_at: -1 }).limit(200).toArray()

  const byVisit = {}
  let totalCost = 0
  for (const m of movements) {
    if (!CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type)) continue
    totalCost += (m.quantity || 0) * (m.purchase_cost || 0)
    const key = m.visit_id || 'general'
    if (!byVisit[key]) byVisit[key] = { visit_id: m.visit_id, items: [], date: m.created_at }
    byVisit[key].items.push({
      item_name: m.item_name,
      quantity: m.quantity,
      cost: (m.quantity || 0) * (m.purchase_cost || 0),
      treatment_name: m.treatment_name,
    })
  }

  return {
    materials_used: movements.filter(m => CONSUMPTION_MOVEMENT_TYPES.has(m.movement_type)),
    total_cost: totalCost,
    by_visit: Object.values(byVisit),
    timeline: movements.map(m => ({
      id: m.id,
      event: m.movement_type,
      item_name: m.item_name,
      quantity: m.quantity,
      created_at: m.created_at,
      treatment_name: m.treatment_name,
    })),
  }
}
