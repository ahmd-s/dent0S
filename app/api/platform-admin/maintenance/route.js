import { NextResponse } from 'next/server'
import { requirePlatformAdmin, logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'
import { createPlatformNotification } from '@/lib/platform-notifications'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const settings = await db.collection('platform_settings').findOne({ _type: 'global' })
    return json({ maintenance: settings?.maintenance || { enabled: false } })
  } catch (e) {
    console.error('Maintenance GET error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const body = await request.json().catch(() => ({}))
    const {
      message,
      estimated_end,
      scope = 'platform',
      clinic_ids = [],
    } = body

    if (!message || !String(message).trim()) {
      return json({ error: 'message is required' }, 400)
    }

    const maintenance = {
      enabled: true,
      message: String(message).trim(),
      scope,
      clinic_ids: scope === 'selected' ? clinic_ids : [],
      estimated_end: estimated_end ? new Date(estimated_end) : null,
      enabled_at: new Date(),
      enabled_by_id: profile.id,
      enabled_by_email: profile.email,
    }

    await db.collection('platform_settings').updateOne(
      { _type: 'global' },
      { $set: { maintenance, updated_at: new Date() } },
      { upsert: true }
    )

    await logPlatformAudit(db, {
      actor: profile,
      action: AUDIT_ACTIONS.MAINTENANCE_ENABLED,
      meta: { scope, message: message.slice(0, 100), estimated_end: estimated_end || null },
    })

    await createPlatformNotification(db, {
      type: 'maintenance_enabled',
      clinicId: null,
      clinicName: 'Platform',
      meta: { scope, message: message.slice(0, 100) },
    }).catch(() => {})

    const response = json({ ok: true, maintenance })
    // Set a lightweight edge-readable cookie for middleware to detect maintenance
    response.headers.append('Set-Cookie', 'dentos_maintenance=true; Path=/; HttpOnly; SameSite=Lax')
    return response
  } catch (e) {
    console.error('Maintenance POST error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function DELETE() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    await db.collection('platform_settings').updateOne(
      { _type: 'global' },
      {
        $set: {
          'maintenance.enabled': false,
          'maintenance.disabled_at': new Date(),
          'maintenance.disabled_by_email': profile.email,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    )

    await logPlatformAudit(db, {
      actor: profile,
      action: AUDIT_ACTIONS.MAINTENANCE_DISABLED,
    })

    const response = json({ ok: true })
    // Clear the maintenance cookie
    response.headers.append('Set-Cookie', 'dentos_maintenance=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
    return response
  } catch (e) {
    console.error('Maintenance DELETE error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
