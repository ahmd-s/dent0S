import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const b = await request.json().catch(() => ({}))
    const filter = { clinic_id: cid, read: { $ne: true } }
    if (Array.isArray(b?.ids) && b.ids.length) filter.id = { $in: b.ids }
    await db.collection('notifications').updateMany(filter, { $set: { read: true, read_at: new Date() } })
    const unread = await db.collection('notifications').countDocuments({ clinic_id: cid, read: { $ne: true } })
    return json({ ok: true, unread_count: unread })
  } catch (e) {
    console.error('Notifications read error:', e)
    return err('Internal server error', 500)
  }
}
