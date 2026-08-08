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
    const q = (searchParams.get('q') || '').trim()
    if (!q || q.length < 2) return json({ clinics: [], staff: [], subscriptions: [] })

    const limit = 8

    // Build regex for partial match (case-insensitive)
    let regexOpts
    try {
      regexOpts = new RegExp(q, 'i')
    } catch {
      return json({ clinics: [], staff: [], subscriptions: [] })
    }

    const [clinics, staff, subscriptions] = await Promise.all([
      // Search clinics by name, slug, id
      db.collection('clinics').find({
        $or: [
          { name: regexOpts },
          { slug: regexOpts },
          { id: q },
          { phone: regexOpts },
        ],
      }).limit(limit).toArray(),

      // Search profiles (staff) by email, name, phone
      db.collection('profiles').find({
        clinic_id: { $ne: null },
        deleted_at: { $exists: false },
        is_platform_admin: { $ne: true },
        $or: [
          { email: regexOpts },
          { full_name: regexOpts },
          { phone: regexOpts },
        ],
      }).limit(limit).toArray(),

      // Search subscriptions by razorpay IDs
      db.collection('subscriptions').find({
        $or: [
          { razorpay_subscription_id: regexOpts },
          { razorpay_customer_id: regexOpts },
          { clinic_id: q },
        ],
      }).limit(limit).toArray(),
    ])

    // Enrich subscriptions with clinic name
    const subClinicIds = [...new Set(subscriptions.map(s => s.clinic_id))]
    const subClinics = subClinicIds.length
      ? await db.collection('clinics').find({ id: { $in: subClinicIds } }).toArray()
      : []
    const subClinicMap = Object.fromEntries(subClinics.map(c => [c.id, c.name]))

    // Enrich staff with clinic name
    const staffClinicIds = [...new Set(staff.map(p => p.clinic_id))]
    const staffClinics = staffClinicIds.length
      ? await db.collection('clinics').find({ id: { $in: staffClinicIds } }).toArray()
      : []
    const staffClinicMap = Object.fromEntries(staffClinics.map(c => [c.id, c]))

    return json({
      clinics: clinics.map(c => ({
        _type: 'clinic',
        id: c.id,
        name: c.name,
        slug: c.slug,
        phone: c.phone || null,
        subscription_status: c.subscription_status,
      })),
      staff: staff.map(p => ({
        _type: 'staff',
        id: p.id,
        clinic_id: p.clinic_id,
        clinic_name: staffClinicMap[p.clinic_id]?.name || '',
        full_name: p.full_name,
        email: p.email,
        role: p.role,
      })),
      subscriptions: subscriptions.map(s => ({
        _type: 'subscription',
        clinic_id: s.clinic_id,
        clinic_name: subClinicMap[s.clinic_id] || '',
        razorpay_subscription_id: s.razorpay_subscription_id || null,
        razorpay_customer_id: s.razorpay_customer_id || null,
        subscription_status: s.subscription_status,
        plan_type: s.plan_type || null,
      })),
    })
  } catch (e) {
    console.error('Search error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
