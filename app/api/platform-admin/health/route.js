import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

function cutoffIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const cutoff = cutoffIso(14)
    const clinics = await db.collection('clinics').find({}).sort({ name: 1 }).toArray()
    const clinicIds = clinics.map(c => c.id)

    const recentVisits = await db.collection('visits').aggregate([
      { $match: { clinic_id: { $in: clinicIds }, visit_date: { $gte: cutoff } } },
      { $group: { _id: '$clinic_id' } },
    ]).toArray()
    const activeSet = new Set(recentVisits.map(r => r._id))

    const lastVisits = await db.collection('visits').aggregate([
      { $match: { clinic_id: { $in: clinicIds } } },
      { $group: { _id: '$clinic_id', last_visit_date: { $max: '$visit_date' } } },
    ]).toArray()
    const lastVisitMap = Object.fromEntries(lastVisits.map(r => [r._id, r.last_visit_date]))

    const inactive = clinics
      .filter(c => !activeSet.has(c.id))
      .map(c => {
        const lastVisitDate = lastVisitMap[c.id] || null
        let daysSince = null
        if (lastVisitDate) {
          daysSince = Math.floor((Date.now() - new Date(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24))
        }
        return {
          id: c.id,
          name: c.name,
          is_active: c.is_active !== false,
          last_visit_date: lastVisitDate,
          days_since_last_visit: daysSince,
        }
      })

    return json({ inactive_clinics: inactive, cutoff_date: cutoff })
  } catch (e) {
    console.error('Platform admin health error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
