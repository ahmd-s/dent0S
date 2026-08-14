import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { cookies } from 'next/headers'

/**
 * Resolved on first use rather than at module load so that `next build`
 * (which imports every route module to collect page data) does not require
 * runtime secrets. Any code path that actually signs or verifies a token
 * still throws when the secret is absent.
 */
function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env var is not set')
  return secret
}

export const AUTH_COOKIE_NAME = 'dentos_token'
export const IMP_COOKIE_NAME = 'dentos_imp'
const COOKIE_NAME = AUTH_COOKIE_NAME

/** Shared auth cookie options — domain must match on set and clear in production. */
export function authCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
    ...(process.env.NODE_ENV === 'production' ? { domain: '.dent-os.in' } : {}),
  }
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10)
}
export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash)
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url')
}
export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function requiresEmailVerification(profile) {
  return profile.email_verified === false
}

export const PLATFORM_ADMIN_SESSION_HOURS = Number(process.env.PLATFORM_ADMIN_SESSION_HOURS || 10)
export const PLATFORM_ADMIN_SESSION = `${PLATFORM_ADMIN_SESSION_HOURS}h`
export const PLATFORM_ADMIN_SESSION_SECONDS = PLATFORM_ADMIN_SESSION_HOURS * 60 * 60

export function signToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, jwtSecret(), { expiresIn })
}
export function verifyToken(token) {
  try { return jwt.verify(token, jwtSecret()) } catch { return null }
}

export function setAuthCookie(token, maxAgeSeconds = 60 * 60 * 24 * 30) {
  cookies().set(COOKIE_NAME, token, authCookieOptions(maxAgeSeconds))
}
export function clearAuthCookie() {
  cookies().set(COOKIE_NAME, '', { ...authCookieOptions(0), maxAge: 0 })
}
export function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

/** Impersonation session cookie — separate from the PA dentos_token. */
export function setImpersonationCookie(token) {
  // 8 hours max — impersonation sessions expire sooner than normal sessions
  cookies().set(IMP_COOKIE_NAME, token, authCookieOptions(60 * 60 * 8))
}
export function clearImpersonationCookie() {
  cookies().set(IMP_COOKIE_NAME, '', { ...authCookieOptions(0), maxAge: 0 })
}
/** Returns the decoded impersonation JWT payload, or null if none / expired. */
export function getCurrentImpersonatedUser() {
  const token = cookies().get(IMP_COOKIE_NAME)?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload?.imp) return null
  return payload
}
