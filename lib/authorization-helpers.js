/**
 * Route-level authorization helpers.
 */

import {
  authorize,
  authorizeSync,
  isClinicAccessBlocked,
  CLINIC_ACCESS_PAUSED_MESSAGE,
  AUTH_CODES,
} from '@/lib/authorization-engine'

export function authorizationDenied(errFn, result) {
  if (result.code === AUTH_CODES.CLINIC_BLOCKED) {
    return errFn(CLINIC_ACCESS_PAUSED_MESSAGE, 403)
  }
  if (result.code === AUTH_CODES.NOT_FOUND) {
    return errFn('Not found', 404)
  }
  return errFn(result.reason || 'Forbidden', result.status || 403)
}

export function authorizeApiSync(ctx, { resource, action, skipClinicCheck = false, checkFeatures = false } = {}) {
  if (!ctx?.profile) {
    return { allowed: false, code: AUTH_CODES.UNAUTHENTICATED, reason: 'Unauthorized', status: 401 }
  }

  if (!skipClinicCheck && isClinicAccessBlocked(ctx.clinic)) {
    return { allowed: false, code: AUTH_CODES.CLINIC_BLOCKED, reason: CLINIC_ACCESS_PAUSED_MESSAGE, status: 403 }
  }

  return authorizeSync({
    profile: ctx.profile,
    clinic: ctx.clinic,
    resource,
    action,
    skipClinicCheck: true,
    checkFeatures,
  })
}

export function guardApiSync(ctx, opts, errFn) {
  const result = authorizeApiSync(ctx, opts)
  if (!result.allowed) return authorizationDenied(errFn, result)
  return null
}

export async function guardApi(ctx, opts, errFn) {
  if (!ctx?.profile) return errFn('Unauthorized', 401)

  if (!opts?.skipClinicCheck && isClinicAccessBlocked(ctx.clinic)) {
    return authorizationDenied(errFn, {
      allowed: false,
      code: AUTH_CODES.CLINIC_BLOCKED,
      reason: CLINIC_ACCESS_PAUSED_MESSAGE,
      status: 403,
    })
  }

  const result = await authorize({
    db: ctx.db,
    profile: ctx.profile,
    clinic: ctx.clinic,
    resource: opts.resource,
    action: opts.action,
    skipClinicCheck: true,
    checkFeatures: opts.checkFeatures ?? false,
    checkWorkspace: opts.checkWorkspace ?? false,
  })

  if (!result.allowed) return authorizationDenied(errFn, result)
  return null
}

export function clinicAccessPausedResponse(errFn) {
  return errFn(CLINIC_ACCESS_PAUSED_MESSAGE, 403)
}

export { isClinicAccessBlocked, CLINIC_ACCESS_PAUSED_MESSAGE }
