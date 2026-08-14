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
 *
 * Read-then-write let two concurrent requests observe the same count and both
 * write count+1, so a burst could exceed `max`. This is a single atomic
 * findOneAndUpdate instead: one round-trip, and the window either carries
 * forward or resets inside the same operation. `expires_at` is maintained so
 * the TTL index can reclaim stale windows.
 */
export async function checkApiRateLimit(db, { scope = 'default', identifier, limits } = {}) {
  const config = limits || DEFAULT_LIMITS[scope] || DEFAULT_LIMITS.default
  const key = rateLimitKey(scope, identifier)
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)
  const windowIsLive = { $gt: ['$window_started_at', windowStart] }

  const doc = await db.collection(COLLECTION).findOneAndUpdate(
    { key },
    [
      {
        $set: {
          key,
          scope,
          identifier,
          window_started_at: { $cond: [windowIsLive, '$window_started_at', now] },
          count: { $cond: [windowIsLive, { $add: [{ $ifNull: ['$count', 0] }, 1] }, 1] },
          updated_at: now,
        },
      },
      {
        $set: {
          expires_at: { $add: ['$window_started_at', config.windowMs] },
        },
      },
    ],
    { upsert: true, returnDocument: 'after' }
  )

  const count = doc?.count ?? 1
  const windowStartedAt = doc?.window_started_at ?? now
  const resetAt = new Date(new Date(windowStartedAt).getTime() + config.windowMs)

  return {
    allowed: count <= config.max,
    remaining: Math.max(0, config.max - count),
    resetAt,
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
