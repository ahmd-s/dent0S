import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200)

    let filter = {}
    if (status === 'unread') filter = { read: false, dismissed: { $ne: true } }
    else if (status === 'resolved') filter = { resolved: true }
    else if (status === 'dismissed') filter = { dismissed: true }

    const notifications = await db
      .collection('platform_notifications')
      .find(filter)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()

    const unreadCount = await db
      .collection('platform_notifications')
      .countDocuments({ read: false, dismissed: { $ne: true } })

    return json({
      notifications: notifications.map(n => {
        const { _id, ...rest } = n
        return rest
      }),
      unread_count: unreadCount,
    })
  } catch (e) {
    console.error('Notifications GET error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
