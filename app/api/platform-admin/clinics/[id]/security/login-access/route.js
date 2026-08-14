import { NextResponse } from 'next/server'
import { requirePlatformAdmin, logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'PATCH,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function PATCH(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const body = await request.json().catch(() => ({}))
    const { user_id, enabled, reason } = body

    if (!user_id) return json({ error: 'user_id is required' }, 400)
    if (enabled === undefined) return json({ error: 'enabled is required' }, 400)
    if (!String(reason || '').trim()) return json({ error: 'A reason is required' }, 400)

    const target = await db.collection('profiles').findOne({ id: user_id, clinic_id: params.id })
    if (!target) return json({ error: 'User not found in this clinic' }, 404)

    await db.collection('profiles').updateOne(
      { id: user_id },
      { $set: { is_active: Boolean(enabled), updated_at: new Date() } }
    )

    const action = enabled ? AUDIT_ACTIONS.SECURITY_LOGIN_ENABLED : AUDIT_ACTIONS.SECURITY_LOGIN_DISABLED

    await logPlatformAudit(db, {
      actor: profile,
      action,
      targetClinicId: params.id,
      targetClinicName: clinic.name,
      meta: { user_id, user_email: target.email, enabled: Boolean(enabled), reason },
    })

    return json({ ok: true })
  } catch (e) {
    console.error('Login access error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
