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
    
    // 1. Fetch current item
    const item = await db.collection('inventory_items').findOne({ id: b.item_id, clinic_id: cid })
    if (!item) return err('Item not found', 404)
    
    // 2. Calculate stock levels
    const stock_before = item.current_stock
    const stock_after = stock_before + b.quantity
    
    // 3. Create stock_movements record
    const movementId = uuidv4()
    await db.collection('stock_movements').insertOne({
      id: movementId,
      clinic_id: cid,
      item_id: b.item_id,
      item_name: item.item_name,
      movement_type: 'STOCK_IN',
      quantity: b.quantity,
      direction: 'in',
      stock_before,
      stock_after,
      reason: b.reason || 'Purchase',
      vendor_id: b.vendor_id || null,
      purchase_cost: b.purchase_cost || null,
      invoice_number: b.invoice_number || null,
      visit_id: null,
      patient_name: null,
      notes: b.notes || '',
      created_by: profile.id,
      created_at: new Date(),
    })
    
    // 4. Update inventory_items
    await db.collection('inventory_items').updateOne(
      { id: b.item_id, clinic_id: cid },
      { $set: { current_stock: stock_after, updated_at: new Date() } }
    )
    
    // Create indexes on first use
    db.collection('stock_movements').createIndex({ clinic_id: 1, created_at: -1 }, { background: true })
    db.collection('stock_movements').createIndex({ clinic_id: 1, item_id: 1, created_at: -1 }, { background: true })
    db.collection('stock_movements').createIndex({ clinic_id: 1, movement_type: 1 }, { background: true })
    
    return json({ ok: true, stock_after })
  } catch (e) {
    console.error('Stock-in error:', e)
    return err('Internal server error', 500)
  }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
