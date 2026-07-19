import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const [totalSignups, completedOnboarding, activityAgg] = await Promise.all([
      db.collection('clinics').countDocuments({}),
      db.collection('clinics').countDocuments({ onboarding_complete: true }),
      db.collection('visits').aggregate([
        { $group: { _id: '$clinic_id' } },
        { $count: 'count' },
      ]).toArray(),
    ])

    return json({
      total_signups: totalSignups,
      completed_onboarding: completedOnboarding,
      has_real_activity: activityAgg[0]?.count || 0,
    })
  } catch (e) {
    console.error('Platform admin funnel error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
