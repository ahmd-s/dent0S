import { NextResponse } from 'next/server'
import {
  requirePlatformAdmin,
  CLINIC_ACCESS_STATUS,
} from '@/lib/platform-admin'
import { TRIAL_AUTO_ENFORCEMENT } from '@/lib/subscription-helpers'
import {
  blockClinic,
  unblockClinic,
  emergencyLock,
  emergencyUnlock,
  setTrialEndDate,
  setTrialEnforcement,
  updateFeatureFlags,
  setAiLimit,
  readState,
} from '@/lib/subscription-engine'

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

function stateToResponse(state) {
  return {
    ok: true,
    subscription_status: state.clinicStatus,
    monthly_ai_usage_limit: state.monthlyAiUsageLimit,
    trial_auto_enforcement: state.trialAutoEnforcement,
    trial_ends_at: state.trialEndsAt,
    features: state.features,
    emergency_locked_at: state.emergencyLockedAt,
    emergency_locked_by: state.emergencyLockedBy,
    emergency_locked_reason: state.emergencyLockedReason,
  }
}

export async function PATCH(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const b = await request.json()
    let anyChange = false

    // ── Clinic access toggle ──────────────────────────────────────────────────
    if (b.subscription_status !== undefined) {
      if (!CLINIC_ACCESS_STATUS.includes(b.subscription_status)) {
        return err('Invalid subscription_status')
      }
      const current = clinic.subscription_status === 'blocked' ? 'blocked' : 'active'
      if (current !== b.subscription_status) {
        const result =
          b.subscription_status === 'blocked'
            ? await blockClinic(db, profile, params.id, { from: current })
            : await unblockClinic(db, profile, params.id, { from: current })
        if (!result.ok) return err(result.error)
        anyChange = true
      }
    }

    // ── Trial auto-enforcement ────────────────────────────────────────────────
    if (b.trial_auto_enforcement !== undefined) {
      if (!TRIAL_AUTO_ENFORCEMENT.includes(b.trial_auto_enforcement)) {
        return err('Invalid trial_auto_enforcement')
      }
      const result = await setTrialEnforcement(db, profile, params.id, { enforcement: b.trial_auto_enforcement })
      if (!result.ok) return err(result.error)
      anyChange = true
    }

    // ── AI usage limit ────────────────────────────────────────────────────────
    if (b.monthly_ai_usage_limit !== undefined) {
      const result = await setAiLimit(db, profile, params.id, { limit: b.monthly_ai_usage_limit })
      if (!result.ok) return err(result.error)
      anyChange = true
    }

    // ── Trial end date ────────────────────────────────────────────────────────
    if (b.trial_ends_at !== undefined) {
      const result = await setTrialEndDate(db, profile, params.id, { date: b.trial_ends_at })
      if (!result.ok) return err(result.error)
      anyChange = true
    }

    // ── Feature flags ─────────────────────────────────────────────────────────
    if (b.features !== undefined) {
      if (typeof b.features !== 'object' || b.features === null) {
        return err('features must be an object')
      }
      const result = await updateFeatureFlags(db, profile, params.id, { features: b.features })
      if (!result.ok) return err(result.error)
      anyChange = true
    }

    // ── Emergency lock / unlock ───────────────────────────────────────────────
    if (b.emergency_lock !== undefined) {
      const shouldLock = Boolean(b.emergency_lock)
      const currentlyLocked = clinic.subscription_status === 'blocked' && !!clinic.emergency_locked_at
      if (shouldLock && !currentlyLocked) {
        const result = await emergencyLock(db, profile, params.id, {
          reason: b.emergency_lock_reason ? String(b.emergency_lock_reason).trim() : '',
        })
        if (!result.ok) return err(result.error)
        anyChange = true
      } else if (!shouldLock && currentlyLocked) {
        const result = await emergencyUnlock(db, profile, params.id)
        if (!result.ok) return err(result.error)
        anyChange = true
      }
    }

    void anyChange
    const state = await readState(db, params.id)
    return json(stateToResponse(state))
  } catch (e) {
    console.error('Platform admin clinic patch error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
