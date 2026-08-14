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

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { db } = ctx
    const url = new URL(request.url)
    const q = url.searchParams.get('q') || ''
    const category = url.searchParams.get('category') || ''
    const clinicId = ctx.profile.clinic_id
    
    if (!q) return json({ templates: [] })
    
    const templates = await db.collection('smart_typing_templates').find({
      $or: [
        { trigger: { $regex: q, $options: 'i' } },
        { expansion: { $regex: q, $options: 'i' } }
      ],
      ...(category ? { category } : {}),
      $or: [
        { clinic_id: null },
        ...(clinicId ? [{ clinic_id: clinicId }] : [])
      ]
    }).limit(20).toArray()
    
    // Sort by exact trigger match first, then partial, then text match
    const sorted = templates.sort((a, b) => {
      const aExact = a.trigger.toLowerCase() === q.toLowerCase()
      const bExact = b.trigger.toLowerCase() === q.toLowerCase()
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      const aStarts = a.trigger.toLowerCase().startsWith(q.toLowerCase())
      const bStarts = b.trigger.toLowerCase().startsWith(q.toLowerCase())
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return 0
    })
    
    return json({ templates: sorted })
  } catch (e) {
    console.error('Smart typing GET error:', e)
    return err('Internal server error', 500)
  }
}
