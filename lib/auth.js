import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is not set')
const COOKIE_NAME = 'dentos_token'

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

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}
export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

export function setAuthCookie(token) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}
export function clearAuthCookie() {
  cookies().set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
}
export function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}
