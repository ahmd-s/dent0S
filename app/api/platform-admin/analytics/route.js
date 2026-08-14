import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

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

function getBuckets(period) {
  const now = new Date()
  const buckets = []
  if (period === '12m') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        label: d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
      })
    }
  } else {
    const days = period === '30d' ? 30 : 90
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const end = new Date(d)
      end.setDate(end.getDate() + 1)
      buckets.push({
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        start: d,
        end,
      })
    }
  }
  return buckets
}

export async function GET(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '12m'

    const buckets = getBuckets(period)
    const firstBucketStart = buckets[0].start
    const lastBucketEnd = buckets[buckets.length - 1].end

    // Clinic signups per bucket
    const clinicSignups = await db.collection('clinics').aggregate([
      { $match: { created_at: { $gte: firstBucketStart, $lt: lastBucketEnd } } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: period !== '12m' ? { $dayOfMonth: '$created_at' } : undefined,
          },
          count: { $sum: 1 },
        },
      },
    ]).toArray()

    // Revenue from manual payments per bucket
    const manualPayments = await db.collection('clinic_manual_payments').aggregate([
      { $match: { recorded_at: { $gte: firstBucketStart, $lt: lastBucketEnd } } },
      {
        $group: {
          _id: {
            year: { $year: '$recorded_at' },
            month: { $month: '$recorded_at' },
            day: period !== '12m' ? { $dayOfMonth: '$recorded_at' } : undefined,
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]).toArray()

    // Trial → active conversions
    const conversions = await db.collection('platform_admin_audit_logs').aggregate([
      {
        $match: {
          action: 'payment_recovered',
          at: { $gte: firstBucketStart, $lt: lastBucketEnd },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$at' },
            month: { $month: '$at' },
            day: period !== '12m' ? { $dayOfMonth: '$at' } : undefined,
          },
          count: { $sum: 1 },
        },
      },
    ]).toArray()

    // Patient growth
    const patientGrowth = await db.collection('patients').aggregate([
      { $match: { created_at: { $gte: firstBucketStart, $lt: lastBucketEnd }, deleted_at: { $exists: false } } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: period !== '12m' ? { $dayOfMonth: '$created_at' } : undefined,
          },
          count: { $sum: 1 },
        },
      },
    ]).toArray()

    // Document growth
    const docGrowth = await db.collection('documents').aggregate([
      { $match: { created_at: { $gte: firstBucketStart, $lt: lastBucketEnd }, deleted_at: { $exists: false } } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: period !== '12m' ? { $dayOfMonth: '$created_at' } : undefined,
          },
          count: { $sum: 1 },
        },
      },
    ]).toArray().catch(() => [])

    // Map aggregation results to buckets
    function matchBucket(bucket, row) {
      if (period === '12m') {
        return row._id.year === bucket.start.getFullYear() &&
               row._id.month === bucket.start.getMonth() + 1
      }
      return row._id.year === bucket.start.getFullYear() &&
             row._id.month === bucket.start.getMonth() + 1 &&
             row._id.day === bucket.start.getDate()
    }

    const clinicGrowth = buckets.map(b => ({
      label: b.label,
      value: clinicSignups.find(r => matchBucket(b, r))?.count || 0,
    }))

    const revenue = buckets.map(b => {
      const row = manualPayments.find(r => matchBucket(b, r))
      return { label: b.label, value: row?.total || 0, count: row?.count || 0 }
    })

    const trialConversions = buckets.map(b => ({
      label: b.label,
      value: conversions.find(r => matchBucket(b, r))?.count || 0,
    }))

    const patients = buckets.map(b => ({
      label: b.label,
      value: patientGrowth.find(r => matchBucket(b, r))?.count || 0,
    }))

    const documents = buckets.map(b => ({
      label: b.label,
      value: docGrowth.find(r => matchBucket(b, r))?.count || 0,
    }))

    // Current snapshot totals
    const [totalClinics, totalPatients, totalDocs] = await Promise.all([
      db.collection('clinics').countDocuments({}),
      db.collection('patients').countDocuments({ deleted_at: { $exists: false } }),
      db.collection('documents').countDocuments({ deleted_at: { $exists: false } }).catch(() => 0),
    ])

    return json({
      period,
      clinicGrowth,
      revenue,
      trialConversions,
      patients,
      documents,
      totals: {
        clinics: totalClinics,
        patients: totalPatients,
        documents: totalDocs,
      },
    })
  } catch (e) {
    console.error('Analytics error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
