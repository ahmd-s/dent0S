import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'PATCH,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function PATCH(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const body = await request.json().catch(() => ({}))
    const { status } = body

    const VALID = ['read', 'resolved', 'dismissed']
    if (!VALID.includes(status)) {
      return json({ error: `status must be one of: ${VALID.join(', ')}` }, 400)
    }

    const update = { $set: { updated_at: new Date() } }
    if (status === 'read') update.$set.read = true
    else if (status === 'resolved') {
      update.$set.read = true
      update.$set.resolved = true
    } else if (status === 'dismissed') {
      update.$set.dismissed = true
    }

    const result = await db
      .collection('platform_notifications')
      .updateOne({ id: params.id }, update)

    if (result.matchedCount === 0) {
      return json({ error: 'Notification not found' }, 404)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('Notification PATCH error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
