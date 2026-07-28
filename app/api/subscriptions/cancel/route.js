import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { canAccessSettings } from '@/lib/rbac'

const json = (d, s=200) => NextResponse.json(d, { status: s })
const err = (msg, s=400) => json({ error: msg }, s)

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  return { profile, db }
}

export async function POST() {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, db } = ctx
  if (!canAccessSettings(profile)) return err('Admins only', 403)
  await db.collection('subscriptions').updateOne(
    { clinic_id: profile.clinic_id },
    { $set: { cancel_at_period_end: true, cancelled_at: new Date(), updated_at: new Date() } }
  )
  return json({ ok: true })
}
