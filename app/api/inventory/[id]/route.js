import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'
import { canManageInventory, canDeleteInventory } from '@/lib/rbac'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const item = await db.collection('inventory_items').findOne({ id: params.id, clinic_id: cid })
    if (!item) return err('Item not found', 404)
    return json({ item: clean(item) })
  } catch (e) {
    console.error('Inventory item GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!canManageInventory(profile)) return err('Forbidden', 403)
    
    const b = await request.json()
    if ('item_name' in b && !b.item_name?.trim()) return err('Item name is required')
    if ('minimum_stock' in b && b.minimum_stock < 0) return err('Minimum stock must be >= 0')
    
    const update = { updated_at: new Date() }
    for (const k of ['item_name', 'category', 'unit', 'minimum_stock', 'vendor_id', 'purchase_price', 'description', 'batch_number', 'expiry_date', 'is_active']) {
      if (k in b) update[k] = k === 'item_name' ? b[k].trim() : b[k]
    }
    
    const r = await db.collection('inventory_items').updateOne({ id: params.id, clinic_id: cid }, { $set: update })
    if (!r.matchedCount) return err('Item not found', 404)
    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(cid, 'inventory')
    return json({ ok: true })
  } catch (e) {
    console.error('Inventory item PUT error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!canManageInventory(profile)) return err('Forbidden', 403)
    if (!canDeleteInventory(profile)) return err('Only admins can delete items', 403)
    
    const r = await db.collection('inventory_items').updateOne({ id: params.id, clinic_id: cid }, { $set: { is_active: false, updated_at: new Date() } })
    if (!r.matchedCount) return err('Item not found', 404)
    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(cid, 'inventory')
    return json({ ok: true })
  } catch (e) {
    console.error('Inventory item DELETE error:', e)
    return err('Internal server error', 500)
  }
}
