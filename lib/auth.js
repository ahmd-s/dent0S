import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is not set')
export const AUTH_COOKIE_NAME = 'dentos_token'
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}
export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
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
