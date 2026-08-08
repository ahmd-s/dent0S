import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import {
  isActivePaidSubscription,
  trialEndsAtFromClinic,
  isTrialAutoBlockPaused,
  trialDaysRemaining,
  isInGracePeriod,
} from '@/lib/subscription-helpers'
import { blockExpiredTrial, blockGraceExpired } from '@/lib/subscription-engine'
import { createPlatformNotificationOnce } from '@/lib/platform-notifications'

const json = (d, s = 200) => NextResponse.json(d, { status: s })

function authorizeCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  return request.headers.get('x-cron-secret') === secret
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
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
    }).toArray()

    let trialBlocked = 0
    let graceBlocked = 0
    let skippedPaid = 0
    let skippedManualPause = 0
    let trialNotExpired = 0
    let graceNotExpired = 0
    let notificationsTrial = 0
    let notificationsGraceTomorrow = 0

    for (const clinic of clinics) {
      const sub = await db.collection('subscriptions').findOne({ clinic_id: clinic.id })

      // ── Trial expiring in 3 days (notification only) ───────────────────────
      if (
        clinic.subscription_status !== 'blocked'
        && !isActivePaidSubscription(sub)
        && sub?.subscription_status === 'trial'
      ) {
        const days = trialDaysRemaining(clinic, sub)
        if (days > 0 && days <= 3) {
          await createPlatformNotificationOnce(db, {
            type: 'trial_expires_in_3_days',
            clinicId: clinic.id,
            clinicName: clinic.name,
            meta: { days_remaining: days, trial_ends_at: clinic.trial_ends_at || null },
            withinHours: 24,
          })
          notificationsTrial++
        }
      }

      // ── Grace expires tomorrow (notification only) ─────────────────────────
      if (isInGracePeriod(sub, now) && clinic.subscription_status !== 'blocked') {
        const graceEnd = new Date(sub.grace_period_end)
        const tomorrowStart = addDays(now, 1)
        tomorrowStart.setHours(0, 0, 0, 0)
        const tomorrowEnd = addDays(tomorrowStart, 1)
        if (graceEnd >= tomorrowStart && graceEnd < tomorrowEnd) {
          await createPlatformNotificationOnce(db, {
            type: 'grace_expires_tomorrow',
            clinicId: clinic.id,
            clinicName: clinic.name,
            meta: { grace_period_end: graceEnd.toISOString() },
            withinHours: 24,
          })
          notificationsGraceTomorrow++
        }
      }

      // ── Grace expiry → block ─────────────────────────────────────────────────
      if (
        clinic.subscription_status !== 'blocked'
        && sub?.subscription_status === 'halted'
        && sub?.grace_period_end
        && new Date(sub.grace_period_end) <= now
        && !isActivePaidSubscription(sub)
      ) {
        await blockGraceExpired(db, clinic.id)
        graceBlocked++
        continue
      }

      // ── Trial expiry → block ─────────────────────────────────────────────────
      if (clinic.subscription_status === 'blocked') continue

      if (isTrialAutoBlockPaused(clinic, now)) {
        skippedManualPause++
        continue
      }

      if (isActivePaidSubscription(sub)) {
        skippedPaid++
        continue
      }

      const trialEnd = trialEndsAtFromClinic(clinic, sub)
      if (!trialEnd || trialEnd > now) {
        trialNotExpired++
        continue
      }

      await blockExpiredTrial(db, clinic.id)
      trialBlocked++
    }

    return json({
      ok: true,
      scanned: clinics.length,
      trial_blocked: trialBlocked,
      grace_blocked: graceBlocked,
      skipped_paid: skippedPaid,
      skipped_manual_pause: skippedManualPause,
      trial_not_expired: trialNotExpired,
      grace_not_expired: graceNotExpired,
      notifications_trial_expiring: notificationsTrial,
      notifications_grace_tomorrow: notificationsGraceTomorrow,
    })
  } catch (e) {
    console.error('Trial expiry cron error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
}
