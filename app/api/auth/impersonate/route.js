import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { verifyToken, signToken, setImpersonationCookie } from '@/lib/auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { token } = body

    if (!token) return json({ error: 'Token required' }, 400)

    const payload = verifyToken(token)
    if (!payload || payload.type !== 'imp_handshake') {
      return json({ error: 'Invalid or expired impersonation token' }, 401)
    }

    const db = await getDb()

    // Verify the target profile still exists and is active
    const profile = await db.collection('profiles').findOne({
      id: payload.target_uid,
      clinic_id: payload.clinic_id,
      deleted_at: { $exists: false },
    })
    if (!profile) return json({ error: 'Target profile not found' }, 404)

    const clinic = await db.collection('clinics').findOne({ id: payload.clinic_id })
    if (!clinic) return json({ error: 'Clinic not found' }, 404)

    // Issue an impersonation session JWT — carries imp flag + who authorized it
    const sessionToken = signToken(
      {
        uid: profile.id,
        cid: profile.clinic_id,
        role: profile.role,
        roles: profile.roles || [profile.role],
        imp: true,
        imp_by_id: payload.imp_by_id,
        imp_by_email: payload.imp_by_email,
        imp_reason: payload.reason,
        imp_clinic_name: clinic.name,
      },
      '8h'
    )

    setImpersonationCookie(sessionToken)

    return json({ ok: true, redirect: '/dashboard', clinic_name: clinic.name })
  } catch (e) {
    console.error('Auth impersonate error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
