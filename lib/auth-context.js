/**
 * Single source of truth for resolving a caller's profile + clinic.
 *
 * This ran as two sequential findOne calls duplicated across ~40 route files.
 * One $lookup does it in a single round-trip. Both documents are returned
 * whole — route handlers read a wide spread of fields, so narrowing with a
 * projection would be a behaviour change.
 *
 * Requires the `profiles.id` and `clinics.id` indexes from lib/setup-indexes.js;
 * without `profiles.id` this lookup is a collection scan.
 */
export async function loadUserContext(db, uid, extra = null) {
  if (!uid) return null

  const doc = await db.collection('profiles').aggregate([
    { $match: { id: uid } },
    { $limit: 1 },
    {
      $lookup: {
        from: 'clinics',
        localField: 'clinic_id',
        foreignField: 'id',
        as: '__clinic',
      },
    },
  ]).next()

  if (!doc) return null
  const { __clinic, ...profile } = doc
  const ctx = { profile, clinic: __clinic?.[0] ?? null, db }
  return extra ? { ...ctx, ...extra } : ctx
}
