import { NextResponse } from 'next/server'
import { requirePlatformAdmin, logPlatformAudit, AUDIT_ACTIONS, getClientIp } from '@/lib/platform-admin'
import { signToken } from '@/lib/auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
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
    const reason = body.reason ? String(body.reason).trim() : ''
    if (!reason) {
      return json({ error: 'A reason is required for impersonation' }, 400)
    }

    // Find clinic owner to impersonate
    const owner = await db.collection('profiles').findOne({
      clinic_id: params.id,
      role: 'admin',
      deleted_at: { $exists: false },
    })
    if (!owner) {
      return json({ error: 'No admin profile found for this clinic' }, 404)
    }

    const ip = getClientIp(request)
    const ua = request.headers.get('user-agent') || ''

    // Short-lived token (10 min) for the impersonation handshake
    const impToken = signToken(
      {
        type: 'imp_handshake',
        clinic_id: params.id,
        clinic_name: clinic.name,
        target_uid: owner.id,
        imp_by_id: profile.id,
        imp_by_email: profile.email,
        ip,
        ua,
        reason,
      },
      '10m'
    )

    await logPlatformAudit(db, {
      actor: profile,
      action: AUDIT_ACTIONS.CLINIC_IMPERSONATED,
      targetClinicId: params.id,
      targetClinicName: clinic.name,
      meta: { reason, ip, ua, target_user: owner.email },
    })

    return json({ token: impToken, clinic_name: clinic.name })
  } catch (e) {
    console.error('Impersonate error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
