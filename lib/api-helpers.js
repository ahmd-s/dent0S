import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { canAccessClinical } from '@/lib/rbac'
import { getProfileRoles, hasRole } from '@/lib/profile-roles'
import {
  isClinicAccessBlocked,
  clinicAccessPausedResponse,
  guardApiSync,
  guardApi,
  authorizationDenied,
} from '@/lib/authorization-helpers'
import { getCorsOrigin, validateCsrf } from '@/lib/security'
import { checkApiRateLimit, getClientIdentifier, getRateLimitForRoute } from '@/lib/api-rate-limit'
import { logApiRequest, logUnhandledException } from '@/lib/system-observability'

export function cors(res, requestOrigin) {
  const origin = getCorsOrigin(requestOrigin) || process.env.CORS_ORIGINS || '*'
  res.headers.set('Access-Control-Allow-Origin', origin)
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token,X-Correlation-Id')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
export const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
export const err = (msg, s = 400) => json({ error: msg }, s)
export const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }
export const isReceptionist = p => hasRole(getProfileRoles(p), 'receptionist')
export const clinicalAccess = p => canAccessClinical(getProfileRoles(p))

export {
  isClinicAccessBlocked,
  clinicAccessPausedResponse,
  guardApiSync,
  guardApi,
  authorizationDenied,
}

/**
 * Resolves the caller's profile and clinic.
 *
 * This runs on every authenticated request, so the profile and clinic are
 * fetched in a single round-trip via $lookup rather than two sequential
 * findOne calls. Both documents are returned whole — callers read a wide
 * spread of fields, so narrowing with a projection would be a behaviour change.
 */
export async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()

  const doc = await db.collection('profiles').aggregate([
    { $match: { id: t.uid } },
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
  return { profile, clinic: __clinic?.[0] ?? null, db }
}

/** Sprint 19 — optional rate limit check for API routes. */
export async function enforceRateLimit(request, userId = null) {
  const db = await getDb()
  const pathname = new URL(request.url).pathname
  const limits = getRateLimitForRoute(pathname)
  const scope = pathname.includes('/api/ai/') ? 'ai'
    : pathname.includes('/api/communication') ? 'communication'
    : pathname.includes('/api/auth/') ? 'auth' : 'default'
  const identifier = getClientIdentifier(request, userId)
  return checkApiRateLimit(db, { scope, identifier, limits })
}

/** Sprint 19 — CSRF validation for mutations (opt-in per route). */
export function enforceCsrf(request, { skip = false } = {}) {
  return validateCsrf(request, { skip })
}

/** Sprint 19 — wrap handler with observability logging. */
export function withApiObservability(handler, routeName) {
  return async (request, context) => {
    const start = performance.now()
    const route = routeName || new URL(request.url).pathname
    let statusCode = 500
    try {
      const response = await handler(request, context)
      statusCode = response?.status || 200
      return response
    } catch (error) {
      logUnhandledException(null, error, { route }).catch(() => {})
      throw error
    } finally {
      const durationMs = performance.now() - start
      logApiRequest(null, {
        route,
        method: request.method,
        durationMs,
        statusCode,
        correlationId: request.headers.get('x-correlation-id'),
      }).catch(() => {})
    }
  }
}
