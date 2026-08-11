/**
 * Sprint 19 — API rate limiting (extends login-rate-limit pattern).
 * In-memory fallback + MongoDB persistence for distributed limits.
 */

const COLLECTION = 'api_rate_limits'

const DEFAULT_LIMITS = {
  default: { windowMs: 60 * 1000, max: 120 },
  ai: { windowMs: 60 * 1000, max: 30 },
  communication: { windowMs: 60 * 1000, max: 60 },
  auth: { windowMs: 15 * 60 * 1000, max: 20 },
  upload: { windowMs: 60 * 1000, max: 20 },
}

function rateLimitKey(scope, identifier) {
  return `${scope}:${identifier}`
}

export function getRateLimitForRoute(pathname) {
  if (!pathname) return DEFAULT_LIMITS.default
  if (pathname.includes('/api/ai/') || pathname.includes('/api/voice/') || pathname.includes('/api/generate-summary')) {
    return DEFAULT_LIMITS.ai
  }
  if (pathname.includes('/api/communication')) return DEFAULT_LIMITS.communication
  if (pathname.includes('/api/auth/')) return DEFAULT_LIMITS.auth
  if (pathname.includes('/upload') || pathname.includes('/files')) return DEFAULT_LIMITS.upload
  return DEFAULT_LIMITS.default
}

/**
 * Check and increment rate limit. Returns { allowed, remaining, resetAt }.
 */
export async function checkApiRateLimit(db, { scope = 'default', identifier, limits } = {}) {
  const config = limits || DEFAULT_LIMITS[scope] || DEFAULT_LIMITS.default
  const key = rateLimitKey(scope, identifier)
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)

  const doc = await db.collection(COLLECTION).findOne({ key })
  let count = 0
  let windowStartedAt = now

  if (doc?.window_started_at && new Date(doc.window_started_at) > windowStart) {
    count = doc.count || 0
    windowStartedAt = doc.window_started_at
  }

  if (count >= config.max) {
    const resetAt = new Date(new Date(windowStartedAt).getTime() + config.windowMs)
    return { allowed: false, remaining: 0, resetAt, limit: config.max }
  }

  const newCount = count + 1
  await db.collection(COLLECTION).updateOne(
    { key },
    {
      $set: {
        key,
        scope,
        identifier,
        count: newCount,
        window_started_at: count === 0 ? now : windowStartedAt,
        updated_at: now,
      },
    },
    { upsert: true }
  )

  return {
    allowed: true,
    remaining: config.max - newCount,
    resetAt: new Date(new Date(windowStartedAt).getTime() + config.windowMs),
    limit: config.max,
  }
}

export function getClientIdentifier(request, userId = null) {
  if (userId) return `user:${userId}`
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

export { COLLECTION, DEFAULT_LIMITS }
