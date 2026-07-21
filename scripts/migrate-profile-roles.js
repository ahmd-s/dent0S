/**
 * One-time batch migration: profiles.role → profiles.roles[]
 * Run: MONGO_URL=... node scripts/migrate-profile-roles.js
 */
import { getDb, closeDb } from '../lib/mongo.js'
import { getProfileRoles } from '../lib/profile-roles.js'

if (!process.env.MONGO_URL) {
  console.error('MONGO_URL env var is required')
  process.exit(1)
}

async function main() {
  const db = await getDb()
  const col = db.collection('profiles')

  const profiles = await col
    .find({
      $or: [
        { roles: { $exists: false } },
        { roles: { $size: 0 } },
        { roles: null },
      ],
    })
    .toArray()

  let migrated = 0
  let skipped = 0

  for (const profile of profiles) {
    const roles = getProfileRoles(profile)
    if (roles.length === 0) {
      skipped++
      continue
    }
    await col.updateOne({ id: profile.id }, { $set: { roles } })
    migrated++
  }

  console.log(`Done. Migrated: ${migrated}, skipped (no valid role): ${skipped}`)
  await closeDb()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
