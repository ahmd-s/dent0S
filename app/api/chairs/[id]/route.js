import { requireUser, json, err } from '@/lib/api-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function PUT(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const id = params.id
  const body = await request.json()
  const cid = ctx.profile.clinic_id

  const existing = await ctx.db.collection('clinic_chairs').findOne({ id, clinic_id: cid })
  if (!existing) return err('Not found', 404)

  const update = {}
  if (body.name) update.name = body.name.trim()
  if (body.color) update.color = body.color
  if (body.sort_order != null) update.sort_order = body.sort_order
  if (body.is_active != null) update.is_active = body.is_active
  if (body.status) update.status = body.status

  await ctx.db.collection('clinic_chairs').updateOne({ id, clinic_id: cid }, { $set: update })
  return json({ ok: true })
}

export async function DELETE(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const id = params.id
  const cid = ctx.profile.clinic_id

  const inUse = await ctx.db.collection('appointments').findOne({
    clinic_id: cid,
    chair_id: id,
    status: { $in: ['scheduled', 'confirmed', 'checked_in', 'waiting', 'called', 'doctor_ready', 'in_treatment', 'treatment_paused', 'lab_pending', 'billing', 'arrived', 'in_progress'] },
  })
  if (inUse) return err('Chair has active appointments', 409)

  await ctx.db.collection('clinic_chairs').updateOne(
    { id, clinic_id: cid },
    { $set: { is_active: false } }
  )
  return json({ ok: true })
}
