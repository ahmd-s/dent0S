import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    
    const b = await request.json()
    if (!b.item_id) return err('Item ID is required')
    if (!b.quantity || b.quantity <= 0) return err('Quantity must be greater than 0')
    if (!b.reason) return err('Reason is required')
    
    // 1. Fetch current item
    const item = await db.collection('inventory_items').findOne({ id: b.item_id, clinic_id: cid })
    if (!item) return err('Item not found', 404)
    
    // 2. Calculate stock levels
    const stock_before = item.current_stock
    
    // 3. Validate sufficient stock
    if (stock_before - b.quantity < 0) {
      return err(`Insufficient stock. Current: ${stock_before}, Requested: ${b.quantity}`, 400)
    }
    
    const stock_after = stock_before - b.quantity
    
    // 4. Create stock_movements record
    const movementId = uuidv4()
    await db.collection('stock_movements').insertOne({
      id: movementId,
      clinic_id: cid,
      item_id: b.item_id,
      item_name: item.item_name,
      movement_type: 'STOCK_OUT',
      quantity: b.quantity,
      direction: 'out',
      stock_before,
      stock_after,
      reason: b.reason,
      vendor_id: null,
      purchase_cost: null,
      invoice_number: null,
      visit_id: null,
      patient_name: null,
      notes: b.notes || '',
      created_by: profile.id,
      created_at: new Date(),
    })
    
    // 5. Update inventory_items
    await db.collection('inventory_items').updateOne(
      { id: b.item_id, clinic_id: cid },
      { $set: { current_stock: stock_after, updated_at: new Date() } }
    )
    
    return json({ ok: true, stock_after })
  } catch (e) {
    console.error('Stock-out error:', e)
    return err('Internal server error', 500)
  }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
