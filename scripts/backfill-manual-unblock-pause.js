/**
 * One-time: clinics manually unblocked via Platform Admin before trial_auto_enforcement
 * existed — set pause from audit log so cron does not re-block them.
 *
 * Finds latest CLINIC_ACCESS_STATUS_CHANGED per clinic where meta went blocked → active
 * (human actor, not system). Skips if clinic is blocked, subscription_exempt, or already paused.
 *
 * Run:
 *   MONGO_URL=... DRY_RUN=1 node scripts/backfill-manual-unblock-pause.js
 *   MONGO_URL=... node scripts/backfill-manual-unblock-pause.js
 */
import { getDb, closeDb } from '../lib/mongo.js'

const ACCESS_CHANGED = 'clinic_access_status_changed'

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL env var is required')
    process.exit(1)
  }

  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
  const db = await getDb()

  const logs = await db.collection('platform_admin_audit_logs')
    .find({ action: ACCESS_CHANGED })
    .sort({ at: -1 })
    .toArray()

  const latestUnblockByClinic = new Map()
  for (const log of logs) {
    const cid = log.target_clinic_id
    if (!cid || latestUnblockByClinic.has(cid)) continue
    const from = log.meta?.from
    const to = log.meta?.to
    if (from !== 'blocked' && from !== 'Blocked') continue
    if (to !== 'active' && to !== 'Active') continue
    if (log.actor_email === 'system') continue
    latestUnblockByClinic.set(cid, log)
  }

  let updated = 0
  let skipped = 0

  for (const [clinicId, log] of latestUnblockByClinic) {
    const clinic = await db.collection('clinics').findOne({ id: clinicId })
    if (!clinic) {
      skipped++
      continue
    }
    if (clinic.subscription_exempt === true) {
      skipped++
      continue
    }
    if (clinic.subscription_status === 'blocked') {
      skipped++
      continue
    }
    if (clinic.trial_auto_enforcement === 'paused') {
      skipped++
      continue
    }

    updated++
    const grantedAt = log.at ? new Date(log.at) : new Date()
    if (dryRun) {
      console.log(`[dry-run] pause ${clinic.name} (${clinicId}) from audit ${grantedAt.toISOString()}`)
    } else {
      await db.collection('clinics').updateOne(
        { id: clinicId },
        {
          $set: {
            trial_auto_enforcement: 'paused',
            manual_access_granted_at: grantedAt,
          },
        }
      )
    }
  }

  console.log('')
  console.log(dryRun ? 'DRY RUN — no writes' : 'Done')
  console.log(`Audit unblock events (unique clinics): ${latestUnblockByClinic.size}`)
  console.log(`Set trial_auto_enforcement paused: ${updated}`)
  console.log(`Skipped: ${skipped}`)

  await closeDb()
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
