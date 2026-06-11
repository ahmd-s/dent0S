import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors, isReceptionist } from '@/lib/api-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (isReceptionist(profile)) return err('Forbidden', 403)
    
    const b = await request.json()
    if ('treatment_name' in b && !b.treatment_name?.trim()) return err('Treatment name is required')
    if ('items' in b) {
      if (!Array.isArray(b.items) || b.items.length === 0) return err('Items array is required')
      for (const item of b.items) {
        if (!item.item_id) return err('Item ID is required for each item')
        if (!item.item_name) return err('Item name is required for each item')
        if (!item.suggested_quantity || item.suggested_quantity <= 0) return err('Suggested quantity must be greater than 0')
      }
    }
    
    const update = { updated_at: new Date() }
    if ('treatment_name' in b) update.treatment_name = b.treatment_name.trim()
    if ('items' in b) update.items = b.items
    
    const r = await db.collection('treatment_templates').updateOne({ id: params.id, clinic_id: cid }, { $set: update })
    if (!r.matchedCount) return err('Template not found', 404)
    return json({ ok: true })
  } catch (e) {
    console.error('Template PUT error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (isReceptionist(profile)) return err('Forbidden', 403)
    
    const r = await db.collection('treatment_templates').deleteOne({ id: params.id, clinic_id: cid })
    if (!r.deletedCount) return err('Template not found', 404)
    return json({ ok: true })
  } catch (e) {
    console.error('Template DELETE error:', e)
    return err('Internal server error', 500)
  }
}
