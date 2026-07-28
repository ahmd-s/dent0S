import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'
import { isActivePaidSubscription, trialEndsAtFromClinic, isTrialAutoBlockPaused } from '@/lib/subscription-helpers'

const json = (d, s = 200) => NextResponse.json(d, { status: s })

function authorizeCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  return request.headers.get('x-cron-secret') === secret
}

export async function GET(request) {
  if (!authorizeCron(request)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const db = await getDb()
    const now = new Date()

    const clinics = await db.collection('clinics').find({
      subscription_exempt: { $ne: true },
      subscription_status: { $ne: 'blocked' },
    }).toArray()

    let blocked = 0
    let skipped = 0
    let skippedManualPause = 0
    let notExpired = 0

    for (const clinic of clinics) {
      if (isTrialAutoBlockPaused(clinic, now)) {
        skippedManualPause++
        continue
      }

      const sub = await db.collection('subscriptions').findOne({ clinic_id: clinic.id })
      if (isActivePaidSubscription(sub)) {
        skipped++
        continue
      }

      const trialEnd = trialEndsAtFromClinic(clinic, sub)
      if (!trialEnd || trialEnd > now) {
        notExpired++
        continue
      }

      await db.collection('clinics').updateOne(
        { id: clinic.id },
        { $set: { subscription_status: 'blocked', updated_at: now } }
      )

      await logPlatformAudit(db, {
        actor: { id: null, email: 'system' },
        action: AUDIT_ACTIONS.TRIAL_EXPIRED_AUTO_BLOCKED,
        targetClinicId: clinic.id,
        targetClinicName: clinic.name,
        meta: { from: 'active', to: 'blocked', automated: true, reason: 'trial_expired' },
      })
      blocked++
    }

    return json({
      ok: true,
      scanned: clinics.length,
      blocked,
      skipped_paid: skipped,
      skipped_manual_pause: skippedManualPause,
      not_expired: notExpired,
    })
  } catch (e) {
    console.error('Trial expiry cron error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
}
