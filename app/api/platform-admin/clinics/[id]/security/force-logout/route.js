import { NextResponse } from 'next/server'
import { requirePlatformAdmin, logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const body = await request.json().catch(() => ({}))
    const reason = String(body.reason || '').trim()
    if (!reason) return json({ error: 'A reason is required' }, 400)

    const now = new Date()

    if (body.user_id) {
      // Force logout a specific user
      const target = await db.collection('profiles').findOne({ id: body.user_id, clinic_id: params.id })
      if (!target) return json({ error: 'User not found in this clinic' }, 404)

      await db.collection('profiles').updateOne(
        { id: body.user_id },
        { $set: { force_logout_at: now } }
      )

      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.SECURITY_FORCE_LOGOUT,
        targetClinicId: params.id,
        targetClinicName: clinic.name,
        meta: { user_id: body.user_id, user_email: target.email, reason, scope: 'user' },
      })
    } else {
      // Force logout all users in clinic
      await db.collection('profiles').updateMany(
        { clinic_id: params.id, deleted_at: { $exists: false } },
        { $set: { force_logout_at: now } }
      )

      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.SECURITY_FORCE_LOGOUT,
        targetClinicId: params.id,
        targetClinicName: clinic.name,
        meta: { reason, scope: 'all' },
      })
    }

    return json({ ok: true })
  } catch (e) {
    console.error('Force logout error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
