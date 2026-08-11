/**
 * Inventory activity logging — Sprint 15.
 */

import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

const FLOW_EVENT_MAP = {
  created: ACTIVITY_EVENTS.ITEM_CREATED,
  purchased: ACTIVITY_EVENTS.PURCHASE_CREATED,
  received: ACTIVITY_EVENTS.STOCK_RECEIVED,
  available: ACTIVITY_EVENTS.STOCK_RECEIVED,
  reserved: ACTIVITY_EVENTS.STOCK_RESERVED,
  consumed: ACTIVITY_EVENTS.STOCK_CONSUMED,
  returned: ACTIVITY_EVENTS.STOCK_RELEASED,
  expired: ACTIVITY_EVENTS.ITEM_EXPIRED,
  disposed: ACTIVITY_EVENTS.ITEM_DISPOSED,
  archived: ACTIVITY_EVENTS.ITEM_UPDATED,
}

const PURCHASE_EVENT_MAP = {
  requested: ACTIVITY_EVENTS.PURCHASE_CREATED,
  approved: ACTIVITY_EVENTS.PURCHASE_APPROVED,
  ordered: ACTIVITY_EVENTS.PURCHASE_CREATED,
  received: ACTIVITY_EVENTS.PURCHASE_RECEIVED,
}

export async function logInventoryFlowChange(db, profile, item, flowStatus, metadata = {}) {
  const event = FLOW_EVENT_MAP[flowStatus] || ACTIVITY_EVENTS.ITEM_UPDATED
  await logActivity(db, profile, event, {
    metadata: {
      item_id: item.id,
      item_name: item.item_name,
      flow_status: flowStatus,
      ...metadata,
    },
  })
}

export async function logInventoryStockEvent(db, profile, event, item, metadata = {}) {
  await logActivity(db, profile, event, {
    patientId: metadata.patient_id || null,
    visitId: metadata.visit_id || null,
    metadata: {
      item_id: item?.id,
      item_name: item?.item_name,
      ...metadata,
    },
  })
}

export async function logPurchaseStatusChange(db, profile, purchase, newStatus, metadata = {}) {
  const event = PURCHASE_EVENT_MAP[newStatus] || ACTIVITY_EVENTS.PURCHASE_CREATED
  await logActivity(db, profile, event, {
    metadata: {
      purchase_id: purchase.id,
      vendor_id: purchase.vendor_id,
      status: newStatus,
      ...metadata,
    },
  })
}

export async function logInventoryAlert(db, profile, event, metadata = {}) {
  await logActivity(db, profile, event, { metadata })
}

export async function logVendorInventoryUpdate(db, profile, vendor, metadata = {}) {
  await logActivity(db, profile, ACTIVITY_EVENTS.VENDOR_UPDATED, {
    metadata: { vendor_id: vendor.id, vendor_name: vendor.name, ...metadata },
  })
}
