import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'
import { canManageInventory } from '@/lib/rbac'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const url = new URL(request.url)
    
    const q = url.searchParams.get('q')
    const category = url.searchParams.get('category')
    const lowStock = url.searchParams.get('low_stock')
    
    const f = { clinic_id: cid, is_active: true }
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      f.$or = [{ item_name: re }, { description: re }]
    }
    if (category) f.category = category
    if (lowStock === 'true') f.$and = [{ current_stock: { $lte: '$minimum_stock' } }]
    
    const items = await db.collection('inventory_items').find(f).sort({ item_name: 1 }).toArray()
    return json({ items: items.map(clean) })
  } catch (e) {
    console.error('Inventory GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    
    if (!canManageInventory(profile)) return err('Forbidden', 403)
    
    const b = await request.json()
    if (!b.item_name || !b.item_name.trim()) return err('Item name is required')
    if (!b.category) return err('Category is required')
    if (!b.unit) return err('Unit is required')
    if (!b.minimum_stock || b.minimum_stock < 0) return err('Minimum stock is required')
    
    const id = uuidv4()
    
    await db.collection('inventory_items').insertOne({
      id,
      clinic_id: cid,
      item_name: b.item_name.trim(),
      category: b.category,
      unit: b.unit,
      current_stock: 0,
      minimum_stock: b.minimum_stock,
      vendor_id: b.vendor_id || null,
      purchase_price: b.purchase_price || 0,
      description: b.description || '',
      batch_number: b.batch_number || null,
      expiry_date: b.expiry_date || null,
      is_active: true,
      created_by: profile.id,
      created_at: new Date(),
      updated_at: new Date(),
    })
    
    // Create indexes on first use
    db.collection('inventory_items').createIndex({ clinic_id: 1, is_active: 1 }, { background: true })
    db.collection('inventory_items').createIndex({ clinic_id: 1, category: 1 }, { background: true })
    db.collection('inventory_items').createIndex({ clinic_id: 1, current_stock: 1, minimum_stock: 1 }, { background: true })
    
    return json({ ok: true, id })
  } catch (e) {
    console.error('Inventory POST error:', e)
    return err('Internal server error', 500)
  }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
