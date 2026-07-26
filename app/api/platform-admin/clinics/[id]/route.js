import { NextResponse } from 'next/server'
import {
  requirePlatformAdmin,
  logPlatformAudit,
  AUDIT_ACTIONS,
  CLINIC_ACCESS_STATUS,
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
        audits.push({
          action: AUDIT_ACTIONS.CLINIC_ACCESS_STATUS_CHANGED,
          meta: { from, to: b.subscription_status },
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
    })
  } catch (e) {
    console.error('Platform admin clinic patch error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
