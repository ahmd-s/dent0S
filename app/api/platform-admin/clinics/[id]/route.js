import { NextResponse } from 'next/server'
import {
  requirePlatformAdmin,
  logPlatformAudit,
  AUDIT_ACTIONS,
  CLINIC_ACCESS_STATUS,
} from '@/lib/platform-admin'
import { TRIAL_AUTO_ENFORCEMENT } from '@/lib/subscription-helpers'

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

function normalizeAccessStatus(clinic) {
  return clinic?.subscription_status === 'blocked' ? 'blocked' : 'active'
}

export async function PATCH(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const b = await request.json()
    const $set = { updated_at: new Date() }
    const audits = []

    if (b.subscription_status !== undefined) {
      if (!CLINIC_ACCESS_STATUS.includes(b.subscription_status)) {
        return err('Invalid subscription_status')
      }
      const from = normalizeAccessStatus(clinic)
      if (from !== b.subscription_status) {
        $set.subscription_status = b.subscription_status
        if (b.subscription_status === 'active' && from === 'blocked') {
          $set.trial_auto_enforcement = 'paused'
          $set.manual_access_granted_at = new Date()
        }
        if (b.subscription_status === 'blocked') {
          $set.trial_auto_enforcement = 'auto'
        }
        audits.push({
          action: AUDIT_ACTIONS.CLINIC_ACCESS_STATUS_CHANGED,
          meta: {
            from,
            to: b.subscription_status,
            ...(b.subscription_status === 'active' && from === 'blocked'
              ? { trial_auto_enforcement: 'paused' }
              : {}),
          },
        })
      }
    }

    if (b.trial_auto_enforcement !== undefined) {
      if (!TRIAL_AUTO_ENFORCEMENT.includes(b.trial_auto_enforcement)) {
        return err('Invalid trial_auto_enforcement')
      }
      const from = clinic.trial_auto_enforcement || 'auto'
      if (from !== b.trial_auto_enforcement) {
        $set.trial_auto_enforcement = b.trial_auto_enforcement
        if (b.trial_auto_enforcement === 'paused' && !clinic.manual_access_granted_at) {
          $set.manual_access_granted_at = new Date()
        }
        if (b.trial_auto_enforcement === 'auto') {
          $set.manual_access_granted_at = null
        }
        audits.push({
          action: AUDIT_ACTIONS.TRIAL_AUTO_ENFORCEMENT_CHANGED,
          meta: { from, to: b.trial_auto_enforcement },
        })
      }
    }

    if (b.monthly_ai_usage_limit !== undefined) {
      let next = b.monthly_ai_usage_limit
      if (next === null || next === '') {
        next = null
      } else {
        next = Number(next)
        if (!Number.isFinite(next) || next < 0) return err('Invalid monthly_ai_usage_limit')
      }
      const from = clinic.monthly_ai_usage_limit ?? null
      if (from !== next) {
        $set.monthly_ai_usage_limit = next
        audits.push({
          action: AUDIT_ACTIONS.AI_USAGE_LIMIT_CHANGED,
          meta: { from, to: next },
        })
      }
    }

    if (Object.keys($set).length <= 1) {
      return json({
        ok: true,
        subscription_status: normalizeAccessStatus(clinic),
        monthly_ai_usage_limit: clinic.monthly_ai_usage_limit ?? null,
        trial_auto_enforcement: clinic.trial_auto_enforcement || 'auto',
      })
    }

    await db.collection('clinics').updateOne({ id: params.id }, { $set })

    for (const a of audits) {
      await logPlatformAudit(db, {
        actor: profile,
        action: a.action,
        targetClinicId: clinic.id,
        targetClinicName: clinic.name,
        meta: a.meta,
      })
    }

    const updated = await db.collection('clinics').findOne({ id: params.id })
    return json({
      ok: true,
      subscription_status: normalizeAccessStatus(updated),
      monthly_ai_usage_limit: updated.monthly_ai_usage_limit ?? null,
      trial_auto_enforcement: updated.trial_auto_enforcement || 'auto',
    })
  } catch (e) {
    console.error('Platform admin clinic patch error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
