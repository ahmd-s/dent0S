import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { setupIndexes } from '@/lib/setup-indexes'

export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

/**
 * Rebuilds every index in lib/setup-indexes.js.
 *
 * Indexes are database-wide rather than clinic-scoped, and building 139 of them
 * is expensive, so this is a platform-operator action. It previously accepted
 * any authenticated clinic user — including a receptionist — which made it an
 * unauthenticated-in-practice way to load the database.
 */
export async function POST() {
  try {
    // 404 rather than 403 so the endpoint's existence isn't disclosed.
    const ctx = await requirePlatformAdmin()
    if (!ctx) return json({ error: 'Not found' }, 404)

    const summary = await setupIndexes(ctx.db)
    return json({ ok: true, ...summary })
  } catch (e) {
    console.error('Setup indexes error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
}
