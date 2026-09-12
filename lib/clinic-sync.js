/**
 * Per-clinic monotonic version clock.
 *
 * Dashboard/list screens poll `/api/sync` (a single indexed document) instead of
 * re-fetching full payloads on a timer. Mutations bump the clock via
 * `invalidateClinicDashboard`, so other logged-in users pick up bookings,
 * queue changes, and stats without a page refresh.
 *
 * This is the right real-time layer for Next.js on Vercel: change streams and
 * long-lived SSE are a poor fit for serverless, and Redis is unnecessary for
 * a one-document-per-clinic counter.
 */

import { getDb } from './mongo.js'

const COLLECTION = 'clinic_sync'

export async function bumpClinicSync(db, clinicId, reason = 'unknown') {
  if (!clinicId) return { ok: false, reason: 'missing_clinic' }
  const conn = db || await getDb()
  await conn.collection(COLLECTION).updateOne(
    { clinic_id: clinicId },
    {
      $inc: { version: 1 },
      $set: { updated_at: new Date(), reason: String(reason || 'unknown') },
      $setOnInsert: { clinic_id: clinicId },
    },
    { upsert: true }
  )
  return { ok: true }
}

/** Fire-and-forget bump so mutation routes stay synchronous. */
export function bumpClinicSyncBackground(clinicId, reason = 'unknown') {
  if (!clinicId) return
  bumpClinicSync(null, clinicId, reason).catch(err => {
    console.error('clinic_sync bump failed:', err?.message || err)
  })
}

export async function getClinicSync(db, clinicId) {
  if (!clinicId) return { version: 0, updated_at: null, reason: null }
  const doc = await db.collection(COLLECTION).findOne(
    { clinic_id: clinicId },
    { projection: { _id: 0, version: 1, updated_at: 1, reason: 1 } }
  )
  return {
    version: doc?.version || 0,
    updated_at: doc?.updated_at || null,
    reason: doc?.reason || null,
  }
}
