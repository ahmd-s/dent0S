import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { readState } from '@/lib/subscription-engine'

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

export async function GET(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

    const checks = []
    const now = Date.now()

    // 1. Database round-trip for this clinic
    try {
      const t0 = Date.now()
      await db.collection('clinics').findOne({ id: params.id }, { projection: { _id: 1 } })
      const latency = Date.now() - t0
      checks.push({
        name: 'Database',
        status: latency < 200 ? 'healthy' : latency < 1000 ? 'warning' : 'failed',
        value: `${latency}ms`,
        label: 'Round-trip latency',
      })
    } catch {
      checks.push({ name: 'Database', status: 'failed', value: null, label: 'Connection error' })
    }

    // 2. Subscription state
    try {
      const state = await readState(db, params.id)
      const accessStatus = clinic.subscription_status === 'blocked' ? 'blocked' : 'active'
      checks.push({
        name: 'Subscription',
        status: accessStatus === 'active' ? 'healthy' : 'warning',
        value: state.billingStatus || 'unknown',
        label: `Access: ${accessStatus}`,
      })
    } catch {
      checks.push({ name: 'Subscription', status: 'failed', value: null, label: 'State read error' })
    }

    // 3. Last staff login
    try {
      const lastLogin = await db.collection('profiles').find(
        { clinic_id: params.id, deleted_at: { $exists: false } },
        { projection: { last_login_at: 1 } }
      ).sort({ last_login_at: -1 }).limit(1).toArray()

      const last = lastLogin[0]?.last_login_at
      if (!last) {
        checks.push({ name: 'Last Login', status: 'warning', value: 'Never', label: 'No logins recorded' })
      } else {
        const daysAgo = Math.floor((now - new Date(last).getTime()) / (1000 * 60 * 60 * 24))
        checks.push({
          name: 'Last Login',
          status: daysAgo > 30 ? 'warning' : 'healthy',
          value: daysAgo === 0 ? 'Today' : `${daysAgo}d ago`,
          label: new Date(last).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
        })
      }
    } catch {
      checks.push({ name: 'Last Login', status: 'failed', value: null, label: 'Read error' })
    }

    // 4. Last activity (visits)
    try {
      const lastVisit = await db.collection('visits').find(
        { clinic_id: params.id },
        { projection: { created_at: 1 } }
      ).sort({ created_at: -1 }).limit(1).toArray()

      const last = lastVisit[0]?.created_at
      if (!last) {
        checks.push({ name: 'Last Activity', status: 'warning', value: 'Never', label: 'No visits recorded' })
      } else {
        const daysAgo = Math.floor((now - new Date(last).getTime()) / (1000 * 60 * 60 * 24))
        checks.push({
          name: 'Last Activity',
          status: daysAgo > 14 ? 'warning' : 'healthy',
          value: daysAgo === 0 ? 'Today' : `${daysAgo}d ago`,
          label: 'Last patient visit',
        })
      }
    } catch {
      checks.push({ name: 'Last Activity', status: 'failed', value: null, label: 'Read error' })
    }

    // 5. Profile count
    try {
      const count = await db.collection('profiles').countDocuments({
        clinic_id: params.id,
        deleted_at: { $exists: false },
        is_active: { $ne: false },
      })
      checks.push({
        name: 'Active Staff',
        status: count === 0 ? 'warning' : 'healthy',
        value: String(count),
        label: 'Active profiles',
      })
    } catch {
      checks.push({ name: 'Active Staff', status: 'failed', value: null, label: 'Read error' })
    }

    // 6. Recent errors (failed audit actions)
    try {
      const recentErrors = await db.collection('platform_admin_audit_logs').find(
        {
          target_clinic_id: params.id,
          action: {
            $in: [
              'trial_expired_auto_blocked',
              'grace_expired_auto_blocked',
              'payment_failed_grace_started',
              'emergency_lock',
            ],
          },
          at: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) },
        },
        { projection: { action: 1, at: 1 } }
      ).sort({ at: -1 }).limit(5).toArray()

      checks.push({
        name: 'Recent Alerts',
        status: recentErrors.length > 0 ? 'warning' : 'healthy',
        value: recentErrors.length > 0 ? String(recentErrors.length) : '0',
        label: recentErrors.length > 0
          ? `Latest: ${recentErrors[0].action.replace(/_/g, ' ')}`
          : 'No alerts in 30 days',
      })
    } catch {
      checks.push({ name: 'Recent Alerts', status: 'failed', value: null, label: 'Read error' })
    }

    // 7. Feature flags health
    const features = clinic.features || {}
    const featureCount = Object.values(features).filter(Boolean).length
    checks.push({
      name: 'Feature Flags',
      status: 'healthy',
      value: `${featureCount} enabled`,
      label: 'Active features',
    })

    // 8. Emergency lock
    checks.push({
      name: 'Emergency Lock',
      status: clinic.emergency_locked_at ? 'failed' : 'healthy',
      value: clinic.emergency_locked_at ? 'LOCKED' : 'Normal',
      label: clinic.emergency_locked_at
        ? `By: ${clinic.emergency_locked_by || 'unknown'}`
        : 'No emergency lock',
    })

    return json({ checks, at: new Date().toISOString() })
  } catch (e) {
    console.error('Diagnostics error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
