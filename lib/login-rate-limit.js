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

export async function recordLoginFailure(db, email, ip) {
  const key = rateLimitKey(email, ip)
  const now = new Date()
  const doc = await db.collection('login_rate_limits').findOne({ key })
  const failed = (doc?.failed_attempts || 0) + 1
  const update = {
    key,
    email: email.toLowerCase().trim(),
    ip: ip || 'unknown',
    failed_attempts: failed,
    updated_at: now,
  }
  if (failed >= MAX_ATTEMPTS) {
    update.locked_until = new Date(now.getTime() + LOCKOUT_MS)
  } else {
    update.locked_until = null
  }
  await db.collection('login_rate_limits').updateOne({ key }, { $set: update }, { upsert: true })
  return { failed, locked: failed >= MAX_ATTEMPTS, lockedUntil: update.locked_until }
}

export async function clearLoginRateLimit(db, email, ip) {
  const key = rateLimitKey(email, ip)
  await db.collection('login_rate_limits').deleteOne({ key })
}

export { MAX_ATTEMPTS, LOCKOUT_MS }
