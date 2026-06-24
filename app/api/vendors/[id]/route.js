import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors, isReceptionist } from '@/lib/api-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const v = await db.collection('vendors').findOne({ id: params.id, clinic_id: cid })
    if (!v) return err('Vendor not found', 404)
    return json({ vendor: clean(v) })
  } catch (e) {
    console.error('Vendor GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (isReceptionist(profile)) return err('Forbidden', 403)
    const b = await request.json()
    if ('name' in b && !b.name?.trim()) return err('Vendor name is required')
    if (b.phone && !/^\d{7,15}$/.test(String(b.phone).replace(/\D/g, ''))) return err('Phone must be 7-15 digits')
    const update = {}
    for (const k of ['name', 'contact_person', 'phone', 'email', 'address', 'material_types', 'notes', 'vendor_type']) {
      if (k in b) update[k] = k === 'name' ? b[k].trim() : (k === 'phone' ? String(b[k] || '').replace(/\D/g, '') : b[k])
    }
    const r = await db.collection('vendors').updateOne({ id: params.id, clinic_id: cid }, { $set: update })
    if (!r.matchedCount) return err('Vendor not found', 404)
    return json({ ok: true })
  } catch (e) {
    console.error('Vendor PUT error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (isReceptionist(profile)) return err('Forbidden', 403)
    const v = await db.collection('vendors').findOne({ id: params.id, clinic_id: cid })
    if (!v) return err('Vendor not found', 404)
    const openCases = await db.collection('lab_cases').countDocuments({
      vendor_id: params.id, clinic_id: cid, status: { $nin: ['completed', 'cancelled'] },
    })
    if (openCases > 0) return err(`Cannot delete: ${openCases} active lab case(s) linked to this vendor`)
    await db.collection('vendors').deleteOne({ id: params.id, clinic_id: cid })
    return json({ ok: true })
  } catch (e) {
    console.error('Vendor DELETE error:', e)
    return err('Internal server error', 500)
  }
}
