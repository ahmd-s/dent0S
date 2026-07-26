import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors, isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/api-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    const { profile, db } = ctx; const cid = profile.clinic_id
    
    const b = await request.json()
    if (!b.visit_id) return err('Visit ID is required')
    if (!b.patient_name) return err('Patient name is required')
    if (!b.items || !Array.isArray(b.items) || b.items.length === 0) return err('Items array is required')
    
    const consumed = []
    const warnings = []
    
    for (const itemReq of b.items) {
      if (!itemReq.item_id) continue
      if (!itemReq.quantity || itemReq.quantity <= 0) continue
      
      // Fetch current item
      const item = await db.collection('inventory_items').findOne({ id: itemReq.item_id, clinic_id: cid })
      if (!item) {
        warnings.push({ item_id: itemReq.item_id, message: 'Item not found' })
        continue
      }
      
      const stock_before = item.current_stock
      
      // Check sufficient stock (warn but don't block)
      if (stock_before - itemReq.quantity < 0) {
        warnings.push({ 
          item_id: itemReq.item_id, 
          item_name: item.item_name, 
          message: `Insufficient stock. Current: ${stock_before}, Requested: ${itemReq.quantity}` 
        })
        // Still proceed with the deduction as much as possible
      }
      
      const stock_after = Math.max(0, stock_before - itemReq.quantity)
      
      // Create stock_movements record
      const movementId = uuidv4()
      await db.collection('stock_movements').insertOne({
        id: movementId,
        clinic_id: cid,
        item_id: itemReq.item_id,
        item_name: item.item_name,
        movement_type: 'AUTO_CONSUMPTION',
        quantity: itemReq.quantity,
        direction: 'out',
        stock_before,
        stock_after,
        reason: 'Treatment Consumption',
        vendor_id: null,
        purchase_cost: item.purchase_price || null,
        invoice_number: null,
        visit_id: b.visit_id,
        patient_name: b.patient_name,
        notes: b.notes || '',
        created_by: profile.id,
        created_at: new Date(),
      })
      
      // Update inventory_items
      await db.collection('inventory_items').updateOne(
        { id: itemReq.item_id, clinic_id: cid },
        { $set: { current_stock: stock_after, updated_at: new Date() } }
      )
      
      consumed.push({ 
        item_id: itemReq.item_id, 
        item_name: item.item_name, 
        quantity: itemReq.quantity, 
        stock_before, 
        stock_after 
      })
    }
    
    return json({ ok: true, consumed, warnings })
  } catch (e) {
    console.error('Consume error:', e)
    return err('Internal server error', 500)
  }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
