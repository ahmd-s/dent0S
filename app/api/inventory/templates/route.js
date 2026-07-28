import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors, isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/api-helpers'
import { canManageInventory } from '@/lib/rbac'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    
    const templates = await db.collection('treatment_templates')
      .find({ clinic_id: cid })
      .sort({ treatment_name: 1 })
      .toArray()
    
    return json({ templates: templates.map(clean) })
  } catch (e) {
    console.error('Templates GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    const { profile, db } = ctx; const cid = profile.clinic_id
    
    if (!canManageInventory(profile)) return err('Forbidden', 403)
    
    const b = await request.json()
    if (!b.treatment_name || !b.treatment_name.trim()) return err('Treatment name is required')
    if (!b.items || !Array.isArray(b.items) || b.items.length === 0) return err('Items array is required')
    
    // Validate each item
    for (const item of b.items) {
      if (!item.item_id) return err('Item ID is required for each item')
      if (!item.item_name) return err('Item name is required for each item')
      if (!item.suggested_quantity || item.suggested_quantity <= 0) return err('Suggested quantity must be greater than 0')
    }
    
    const id = uuidv4()
    
    await db.collection('treatment_templates').insertOne({
      id,
      clinic_id: cid,
      treatment_name: b.treatment_name.trim(),
      items: b.items,
      created_by: profile.id,
      created_at: new Date(),
      updated_at: new Date(),
    })
    
    // Create index on first use
    db.collection('treatment_templates').createIndex({ clinic_id: 1 }, { background: true })
    
    return json({ ok: true, id })
  } catch (e) {
    console.error('Templates POST error:', e)
    return err('Internal server error', 500)
  }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
