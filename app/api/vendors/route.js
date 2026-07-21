import { v4 as uuidv4 } from 'uuid'
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
    const type = url.searchParams.get('type')
    const f = { clinic_id: cid, is_archived: { $ne: true } }
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      f.$or = [{ name: re }, { contact_person: re }, { phone: re }]
    }
    if (type === 'supplier') {
      f.$or = [
        { vendor_type: 'supplier' },
        { vendor_type: 'both' },
        { vendor_type: { $exists: false } }
      ]
    }
    if (type === 'dental_lab') {
      f.$or = [
        { vendor_type: 'dental_lab' },
        { vendor_type: 'both' },
        { vendor_type: { $exists: false } }
      ]
    }
    const list = await db.collection('vendors').find(f).sort({ name: 1 }).toArray()
    return json({ vendors: list.map(clean) })
  } catch (e) {
    console.error('Vendors GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!canManageInventory(profile)) return err('Forbidden', 403)
    const b = await request.json()
    if (!b.name || !b.name.trim()) return err('Vendor name is required')
    if (b.phone && !/^\d{7,15}$/.test(String(b.phone).replace(/\D/g, ''))) return err('Phone must be 7-15 digits')
    const id = uuidv4()
    await db.collection('vendors').insertOne({
      id,
      clinic_id: cid,
      name: b.name.trim(),
      contact_person: b.contact_person || '',
      phone: b.phone ? String(b.phone).replace(/\D/g, '') : '',
      email: b.email || '',
      address: b.address || '',
      material_types: b.material_types || '',
      notes: b.notes || '',
      is_archived: false,
      created_by: profile.id,
      created_at: new Date(),
    })
    return json({ ok: true, id })
  } catch (e) {
    console.error('Vendors POST error:', e)
    return err('Internal server error', 500)
  }
}
