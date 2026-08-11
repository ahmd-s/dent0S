import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requireUser, json, err, cors, clean } from '@/lib/api-helpers'

const DEFAULT_CHAIRS = [
  { name: 'Chair 1', color: '#0D9488', sort_order: 1 },
  { name: 'Chair 2', color: '#6366F1', sort_order: 2 },
  { name: 'Chair 3', color: '#F59E0B', sort_order: 3 },
  { name: 'Surgery', color: '#EF4444', sort_order: 4 },
]

async function ensureDefaultChairs(db, clinicId) {
  const count = await db.collection('clinic_chairs').countDocuments({ clinic_id: clinicId })
  if (count > 0) return
  const now = new Date()
  const docs = DEFAULT_CHAIRS.map(c => ({
    id: uuidv4(),
    clinic_id: clinicId,
    ...c,
    is_active: true,
    created_at: now,
  }))
  if (docs.length) await db.collection('clinic_chairs').insertMany(docs)
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const cid = ctx.profile.clinic_id
  await ensureDefaultChairs(ctx.db, cid)

  const chairs = await ctx.db.collection('clinic_chairs')
    .find({ clinic_id: cid, is_active: { $ne: false } })
    .sort({ sort_order: 1, name: 1 })
    .toArray()

  const today = new Date().toISOString().slice(0, 10)
  const appts = await ctx.db.collection('appointments').find({
    clinic_id: cid,
    appointment_date: today,
    chair_id: { $ne: null },
    status: { $in: ['scheduled', 'confirmed', 'checked_in', 'waiting', 'called', 'in_treatment', 'arrived', 'in_progress'] },
  }).toArray()

  const utilByChair = {}
  for (const a of appts) {
    if (!a.chair_id) continue
    utilByChair[a.chair_id] = (utilByChair[a.chair_id] || 0) + (a.duration_minutes || 30)
  }

  return json({
    chairs: chairs.map(c => ({
      ...clean(c),
      utilization_minutes: utilByChair[c.id] || 0,
    })),
  })
}

export async function POST(request) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const body = await request.json()
  if (!body.name?.trim()) return err('Name required')

  const cid = ctx.profile.clinic_id
  const maxOrder = await ctx.db.collection('clinic_chairs')
    .find({ clinic_id: cid })
    .sort({ sort_order: -1 })
    .limit(1)
    .toArray()

  const doc = {
    id: uuidv4(),
    clinic_id: cid,
    name: body.name.trim(),
    color: body.color || '#0D9488',
    sort_order: body.sort_order ?? ((maxOrder[0]?.sort_order || 0) + 1),
    is_active: true,
    created_at: new Date(),
  }

  await ctx.db.collection('clinic_chairs').insertOne(doc)
  return json({ ok: true, chair: clean(doc) })
}
