import { NextResponse } from 'next/server'
import {
  requirePlatformAdmin,
  logPlatformAudit,
  AUDIT_ACTIONS,
  PLATFORM_STATUS,
} from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
const err = (msg, s = 400) => json({ error: msg }, s)

export async function PUT(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const b = await request.json()
    const nextStatus = b.platform_status === null || b.platform_status === '' ? null : b.platform_status
    if (nextStatus !== null && !PLATFORM_STATUS.includes(nextStatus)) {
      return err('Invalid platform_status')
    }

    const existing = await db.collection('subscriptions').findOne({ clinic_id: params.id })
    const from = existing?.platform_status ?? null

    await db.collection('subscriptions').updateOne(
      { clinic_id: params.id },
      {
        $set: {
          platform_status: nextStatus,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    )

    await logPlatformAudit(db, {
      actor: profile,
      action: AUDIT_ACTIONS.SUBSCRIPTION_STATUS_CHANGED,
      targetClinicId: clinic.id,
      targetClinicName: clinic.name,
      meta: { from, to: nextStatus },
    })

    return json({ ok: true, platform_status: nextStatus })
  } catch (e) {
    console.error('Platform admin subscription update error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
