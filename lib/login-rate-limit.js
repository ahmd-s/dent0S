const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

function rateLimitKey(email, ip) {
  return `${email.toLowerCase().trim()}:${ip || 'unknown'}`
}

export async function checkLoginRateLimit(db, email, ip) {
  const key = rateLimitKey(email, ip)
  const doc = await db.collection('login_rate_limits').findOne({ key })
  if (!doc?.locked_until) return { locked: false, doc }
  if (new Date(doc.locked_until) > new Date()) {
    return { locked: true, lockedUntil: doc.locked_until, doc }
  }
  return { locked: false, doc }
}

/**
 * Single atomic increment rather than read-then-write, so concurrent failed
 * logins cannot both observe the same attempt count and under-count towards the
 * lockout. `expires_at` lets the TTL index drop rows once the window has passed.
 */
export async function recordLoginFailure(db, email, ip) {
  const key = rateLimitKey(email, ip)
  const now = new Date()

  const doc = await db.collection('login_rate_limits').findOneAndUpdate(
    { key },
    [
      {
        $set: {
          key,
          email: email.toLowerCase().trim(),
          ip: ip || 'unknown',
          failed_attempts: { $add: [{ $ifNull: ['$failed_attempts', 0] }, 1] },
          updated_at: now,
          expires_at: new Date(now.getTime() + LOCKOUT_MS),
        },
      },
      {
        $set: {
          locked_until: {
            $cond: [
              { $gte: ['$failed_attempts', MAX_ATTEMPTS] },
              new Date(now.getTime() + LOCKOUT_MS),
              null,
            ],
          },
        },
      },
    ],
    { upsert: true, returnDocument: 'after' }
  )

  const failed = doc?.failed_attempts ?? 1
  return { failed, locked: failed >= MAX_ATTEMPTS, lockedUntil: doc?.locked_until ?? null }
}

export async function clearLoginRateLimit(db, email, ip) {
  const key = rateLimitKey(email, ip)
  await db.collection('login_rate_limits').deleteOne({ key })
}

export { MAX_ATTEMPTS, LOCKOUT_MS }
