import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { SMART_TYPING_SEED } from '@/lib/smart-typing-seed'
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

export async function POST() {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { db } = ctx
    const count = await db.collection('smart_typing_templates').countDocuments()
    if (count >= 331) return json({ ok: true, message: 'Already seeded' })
    await db.collection('smart_typing_templates').insertMany(
      SMART_TYPING_SEED.map(t => ({ ...t, clinic_id: null, is_custom: false }))
    )
    return json({ ok: true, seeded: 331 })
  } catch (e) {
    console.error('Smart typing seed error:', e)
    return err('Internal server error', 500)
  }
}
