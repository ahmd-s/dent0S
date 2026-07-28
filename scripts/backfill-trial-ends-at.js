/**
 * One-time migration when trial billing goes live.
 *
 * - Clinics created BEFORE TRIAL_BILLING_CUTOFF → subscription_exempt: true (grandfathered;
 *   cron will never auto-block them for trial expiry).
 * - Clinics created ON/AFTER cutoff → subscription_exempt: false and trial_ends_at set from
 *   signup date + 14 days if missing (does NOT copy subscriptions.trial_end for old rows).
 *
 * Does NOT copy subscriptions.trial_end for pre-cutoff clinics — that date is often years in
 * the past and would cause immediate auto-block if used.
 *
 * Run (dry run first):
 *   MONGO_URL=... TRIAL_BILLING_CUTOFF=2026-07-26T00:00:00.000Z DRY_RUN=1 node scripts/backfill-trial-ends-at.js
 *   MONGO_URL=... TRIAL_BILLING_CUTOFF=2026-07-26T00:00:00.000Z node scripts/backfill-trial-ends-at.js
 *
 * Set TRIAL_BILLING_CUTOFF to the moment this feature deploys (UTC ISO recommended).
 */
import { getDb, closeDb } from '../lib/mongo.js'

const TRIAL_MS = 14 * 24 * 60 * 60 * 1000

function parseCutoff() {
  const raw = process.env.TRIAL_BILLING_CUTOFF
  if (!raw?.trim()) {
    console.error('TRIAL_BILLING_CUTOFF is required (ISO datetime, e.g. 2026-07-26T00:00:00.000Z)')
    process.exit(1)
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    console.error('TRIAL_BILLING_CUTOFF is not a valid date:', raw)
    process.exit(1)
  }
  return d
}

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL env var is required')
    process.exit(1)
  }

  const cutoff = parseCutoff()
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

  const db = await getDb()
  const clinics = await db.collection('clinics').find({}).toArray()

  let grandfathered = 0
  let postCutoffTrialSet = 0
  let postCutoffSkipped = 0
  let skippedNoCreatedAt = 0

  for (const c of clinics) {
    if (!c.created_at) {
      skippedNoCreatedAt++
      console.warn(`Skip clinic ${c.id} (${c.name}): missing created_at — set subscription_exempt manually if needed`)
      continue
    }

    const created = new Date(c.created_at)
    if (created < cutoff) {
      if (c.subscription_exempt === true) continue
      grandfathered++
      if (dryRun) {
        console.log(`[dry-run] grandfather exempt: ${c.name} (${c.id}) created ${created.toISOString()}`)
      } else {
        await db.collection('clinics').updateOne(
          { id: c.id },
          {
            $set: {
              subscription_exempt: true,
              billing_grandfathered_at: new Date(),
            },
          }
        )
      }
      continue
    }

    if (c.trial_ends_at) {
      postCutoffSkipped++
      continue
    }

    const trialEndsAt = new Date(created.getTime() + TRIAL_MS)
    postCutoffTrialSet++
    if (dryRun) {
      console.log(`[dry-run] set trial_ends_at ${trialEndsAt.toISOString()} for ${c.name} (${c.id})`)
    } else {
      await db.collection('clinics').updateOne(
        { id: c.id },
        {
          $set: {
            subscription_exempt: false,
            trial_ends_at: trialEndsAt,
          },
        }
      )
    }
  }

  console.log('')
  console.log(dryRun ? 'DRY RUN — no writes performed' : 'Done')
  console.log(`Cutoff: ${cutoff.toISOString()}`)
  console.log(`Clinics scanned: ${clinics.length}`)
  console.log(`Grandfathered (subscription_exempt: true): ${grandfathered}`)
  console.log(`Post-cutoff trial_ends_at set: ${postCutoffTrialSet}`)
  console.log(`Post-cutoff already had trial_ends_at: ${postCutoffSkipped}`)
  if (skippedNoCreatedAt) console.log(`Skipped (no created_at): ${skippedNoCreatedAt}`)

  await closeDb()
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
