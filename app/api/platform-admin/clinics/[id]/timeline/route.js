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

export async function GET(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

    const [auditLogs, payments, supportNotes, subscription] = await Promise.all([
      db.collection('platform_admin_audit_logs')
        .find({ target_clinic_id: params.id })
        .sort({ at: -1 })
        .limit(100)
        .toArray(),

      db.collection('clinic_manual_payments')
        .find({ clinic_id: params.id })
        .sort({ recorded_at: -1 })
        .limit(50)
        .toArray(),

      db.collection('clinic_support_notes')
        .find({ clinic_id: params.id })
        .sort({ created_at: -1 })
        .limit(50)
        .toArray(),

      db.collection('subscriptions').findOne({ clinic_id: params.id }),
    ])

    const events = []

    // Clinic creation
    events.push({
      type: 'clinic',
      event: 'clinic_created',
      title: 'Clinic Created',
      detail: `${clinic.name} was created`,
      actor: null,
      at: clinic.created_at,
    })

    // Subscription creation
    if (subscription?.created_at) {
      events.push({
        type: 'subscription',
        event: 'subscription_created',
        title: 'Subscription Record Created',
        detail: `Status: ${subscription.subscription_status || 'unknown'}`,
        actor: null,
        at: subscription.created_at,
      })
    }

    // Audit logs
    for (const log of auditLogs) {
      events.push({
        type: 'audit',
        event: log.action,
        title: formatAuditTitle(log.action),
        detail: formatAuditDetail(log),
        actor: log.actor_email || null,
        at: log.at,
      })
    }

    // Payments
    for (const p of payments) {
      events.push({
        type: 'payment',
        event: 'manual_payment',
        title: 'Manual Payment Recorded',
        detail: `₹${p.amount?.toLocaleString('en-IN') || 0} via ${p.method || 'unknown'}${p.note ? ` — ${p.note}` : ''}`,
        actor: p.recorded_by_email || null,
        at: p.recorded_at,
      })
    }

    // Support notes
    for (const note of supportNotes) {
      events.push({
        type: 'support',
        event: `support_${note.type || 'note'}`,
        title: formatSupportTitle(note.type),
        detail: note.content?.slice(0, 120) || '',
        actor: note.author_email || null,
        at: note.created_at,
      })
    }

    // Sort descending by timestamp
    events.sort((a, b) => new Date(b.at) - new Date(a.at))

    return json({ events })
  } catch (e) {
    console.error('Timeline error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

function formatAuditTitle(action) {
  const map = {
    clinic_impersonated: 'Clinic Impersonated',
    impersonation_exited: 'Impersonation Exited',
    emergency_lock: 'Emergency Lock',
    emergency_unlock: 'Emergency Unlock',
    lifecycle_status_changed: 'Lifecycle Changed',
    subscription_status_changed: 'Subscription Changed',
    clinic_access_status_changed: 'Access Status Changed',
    ai_usage_limit_changed: 'AI Limit Changed',
    manual_payment_recorded: 'Manual Payment',
    trial_expired_auto_blocked: 'Trial Expired — Auto Blocked',
    trial_auto_enforcement_changed: 'Trial Enforcement Changed',
    trial_date_changed: 'Trial Date Changed',
    feature_flags_changed: 'Feature Flags Changed',
    payment_recovered: 'Payment Recovered',
    payment_failed_grace_started: 'Payment Failed — Grace Started',
    grace_expired_auto_blocked: 'Grace Expired — Auto Blocked',
    support_note_added: 'Support Note Added',
    security_force_logout: 'Force Logout',
    security_login_disabled: 'Login Disabled',
    security_login_enabled: 'Login Enabled',
  }
  return map[action] || action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatAuditDetail(log) {
  const meta = log.meta || {}
  if (meta.status) return `Status: ${meta.status}`
  if (meta.lifecycle) return `Lifecycle: ${meta.lifecycle}`
  if (meta.reason) return `Reason: ${meta.reason}`
  if (meta.limit !== undefined) return `AI limit: ${meta.limit ?? 'unlimited'}`
  if (meta.enforcement) return `Enforcement: ${meta.enforcement}`
  const keys = Object.keys(meta).filter(k => meta[k] != null && meta[k] !== '')
  return keys.slice(0, 2).map(k => `${k.replace(/_/g, ' ')}: ${meta[k]}`).join(' · ')
}

function formatSupportTitle(type) {
  const map = {
    note: 'Support Note',
    issue: 'Issue Logged',
    feature_request: 'Feature Request',
    call_log: 'Call Logged',
  }
  return map[type] || 'Support Entry'
}
