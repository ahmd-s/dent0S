import { cookies } from 'next/headers'
import { signToken, verifyToken } from '@/lib/auth'

export const OAUTH_STATE_COOKIE = 'google_oauth_state'
export const GOOGLE_SIGNUP_PENDING_COOKIE = 'dentos_google_signup'
export const GOOGLE_PA_PENDING_COOKIE = 'dentos_google_pa_pending'

const SIGNUP_PENDING_EXPIRY = '15m'
const PA_PENDING_MAX_AGE = 60 * 5

export function setOAuthStateCookie(state) {
  cookies().set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  })
}

export function consumeOAuthStateCookie() {
  const jar = cookies()
  const state = jar.get(OAUTH_STATE_COOKIE)?.value
  jar.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return state || null
}

export function setGoogleSignupPendingCookie({ email, full_name, google_sub }) {
  const token = signToken(
    {
      purpose: 'google_signup_pending',
      email,
      full_name,
      google_sub,
    },
    SIGNUP_PENDING_EXPIRY
  )
  cookies().set(GOOGLE_SIGNUP_PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 15,
  })
}

export function readGoogleSignupPendingCookie() {
  const token = cookies().get(GOOGLE_SIGNUP_PENDING_COOKIE)?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload || payload.purpose !== 'google_signup_pending') return null
  if (!payload.email || !payload.google_sub) return null
  return {
    email: payload.email,
    full_name: payload.full_name || '',
    google_sub: payload.google_sub,
  }
}

export function clearGoogleSignupPendingCookie() {
  cookies().set(GOOGLE_SIGNUP_PENDING_COOKIE, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  })
}

export function setGooglePlatformAdminPendingCookie(pendingToken, setupRequired) {
  const value = JSON.stringify({ pending_token: pendingToken, setup_required: !!setupRequired })
  cookies().set(GOOGLE_PA_PENDING_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PA_PENDING_MAX_AGE,
  })
}

export function consumeGooglePlatformAdminPendingCookie() {
  const raw = cookies().get(GOOGLE_PA_PENDING_COOKIE)?.value
  cookies().set(GOOGLE_PA_PENDING_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.pending_token) return null
    return parsed
  } catch {
    return null
  }
}
