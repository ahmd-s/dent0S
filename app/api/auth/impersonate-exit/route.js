import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { clearImpersonationCookie, getCurrentImpersonatedUser } from '@/lib/auth'
import { logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST() {
  try {
    const imp = getCurrentImpersonatedUser()

    if (imp?.imp) {
      try {
        const db = await getDb()
        const clinic = await db.collection('clinics').findOne({ id: imp.cid })
        await logPlatformAudit(db, {
          actor: { id: imp.imp_by_id, email: imp.imp_by_email },
          action: AUDIT_ACTIONS.IMPERSONATION_EXITED,
          targetClinicId: imp.cid,
          targetClinicName: clinic?.name || imp.imp_clinic_name || '',
          meta: { impersonated_user: imp.uid, reason: imp.imp_reason },
        })
      } catch {
        // Non-fatal — always clear the cookie
      }
    }

    clearImpersonationCookie()
    return cors(NextResponse.json({ ok: true }))
  } catch (e) {
    console.error('Impersonate exit error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
