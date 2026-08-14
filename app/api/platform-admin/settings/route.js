import { NextResponse } from 'next/server'
import { requirePlatformAdmin, logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

const DEFAULTS = {
  trial_length_days: 14,
  grace_period_days: 7,
  default_ai_limit: null,
  branding: {
    name: 'DentOS',
    support_email: 'support@dent-os.in',
  },
  broadcast_templates: [],
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const settings = await db.collection('platform_settings').findOne({ _type: 'global' })
    const clean = settings ? (({ _id, maintenance, ...rest }) => rest)(settings) : {}

    return json({ settings: { ...DEFAULTS, ...clean } })
  } catch (e) {
    console.error('Settings GET error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function PUT(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const body = await request.json().catch(() => ({}))

    // Only allow known keys to be updated
    const ALLOWED_KEYS = [
      'trial_length_days',
      'grace_period_days',
      'default_ai_limit',
      'branding',
      'broadcast_templates',
    ]

    const updates = {}
    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: 'No valid keys to update' }, 400)
    }

    // Validate numeric fields
    if (updates.trial_length_days !== undefined) {
      const v = Number(updates.trial_length_days)
      if (isNaN(v) || v < 1 || v > 365) return json({ error: 'trial_length_days must be 1–365' }, 400)
      updates.trial_length_days = v
    }
    if (updates.grace_period_days !== undefined) {
      const v = Number(updates.grace_period_days)
      if (isNaN(v) || v < 0 || v > 90) return json({ error: 'grace_period_days must be 0–90' }, 400)
      updates.grace_period_days = v
    }

    updates.updated_at = new Date()

    await db.collection('platform_settings').updateOne(
      { _type: 'global' },
      { $set: { _type: 'global', ...updates } },
      { upsert: true }
    )

    await logPlatformAudit(db, {
      actor: profile,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      meta: { keys: Object.keys(updates).filter(k => k !== 'updated_at') },
    })

    return json({ ok: true })
  } catch (e) {
    console.error('Settings PUT error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
