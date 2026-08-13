import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/api-helpers'
import { receiveStockBatch, InventoryFlowError } from '@/lib/inventory-workflow-engine'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    const { profile, db } = ctx; const cid = profile.clinic_id

    const b = await request.json()
    if (!b.item_id) return err('Item ID is required')
    if (!b.quantity || b.quantity <= 0) return err('Quantity must be greater than 0')

    const item = await db.collection('inventory_items').findOne({ id: b.item_id, clinic_id: cid })
    if (!item) return err('Item not found', 404)

    const result = await receiveStockBatch(db, profile, item, {
      quantity: b.quantity,
      vendor_id: b.vendor_id,
      purchase_cost: b.purchase_cost,
      invoice_number: b.invoice_number,
      batch_number: b.batch_number,
      expiry_date: b.expiry_date,
      reason: b.reason || 'Purchase',
      notes: b.notes || '',
    })

    db.collection('stock_movements').createIndex({ clinic_id: 1, created_at: -1 }, { background: true })
    db.collection('inventory_batches').createIndex({ clinic_id: 1, item_id: 1 }, { background: true })

    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(cid, 'inventory')
    return json({ ok: true, stock_after: result.stock_after, batch_id: result.batch_id })
  } catch (e) {
    if (e instanceof InventoryFlowError) return err(e.message, e.status)
    console.error('Stock-in error:', e)
    return err('Internal server error', 500)
  }
}
