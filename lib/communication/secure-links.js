import { v4 as uuidv4 } from 'uuid'


export function visitTokenTtlMs() {
  const days = parseInt(process.env.VISIT_SHARE_TOKEN_TTL_DAYS || '7', 10)
  return Math.max(1, days) * 24 * 60 * 60 * 1000
}

export async function ensureVisitShareToken(db, clinicId, visitId) {
  const visit = await db.collection('visits').findOne({ id: visitId, clinic_id: clinicId })
  if (!visit) return null

  const now = new Date()
  const expiresAt = visit.share_token_expires_at ? new Date(visit.share_token_expires_at) : null
  if (visit.share_token && expiresAt && expiresAt > now) {
    return { token: visit.share_token, expires_at: expiresAt }
  }

  const token = uuidv4()
  const newExpiresAt = new Date(now.getTime() + visitTokenTtlMs())
  await db.collection('visits').updateOne(
    { id: visitId, clinic_id: clinicId },
    {
      $set: {
        share_token: token,
        share_token_expires_at: newExpiresAt,
        share_token_created_at: now,
      },
    }
  )
  return { token, expires_at: newExpiresAt }
}

export function buildVisitSummaryPublicUrl(token, baseUrl) {
  const root = baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  return `${root.replace(/\/$/, '')}/visit-summary/${token}`
}

export function isShareTokenValid(doc) {
  if (!doc?.share_token) return false
  if (!doc.share_token_expires_at) return true
  return new Date(doc.share_token_expires_at) > new Date()
}
