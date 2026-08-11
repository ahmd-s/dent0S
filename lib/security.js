/**
 * Sprint 19 — Security utilities (additive, no business logic changes).
 * CSRF, input validation, sanitization, SSRF guards, prompt injection safeguards.
 */

import crypto from 'crypto'
import { cookies } from 'next/headers'

export const CSRF_COOKIE = 'dentos_csrf'
export const CSRF_HEADER = 'x-csrf-token'

const ALLOWED_IMAGE_HOSTS = (process.env.ALLOWED_IMAGE_HOSTS || 'res.cloudinary.com,cloudinary.com').split(',').map(h => h.trim())
const MAX_STRING_LENGTH = 50000
const MAX_PROMPT_LENGTH = 32000

/** Generate and set CSRF token cookie (call on login). */
export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function setCsrfCookie(token) {
  cookies().set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    ...(process.env.NODE_ENV === 'production' ? { domain: '.dent-os.in' } : {}),
  })
}

export function clearCsrfCookie() {
  cookies().set(CSRF_COOKIE, '', { maxAge: 0, path: '/' })
}

/** Validate CSRF for state-changing requests. Skip for cron/webhook/public routes. */
export function validateCsrf(request, { skip = false } = {}) {
  if (skip) return { ok: true }
  const method = request.method?.toUpperCase()
  if (!method || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return { ok: true }

  const cookieToken = cookies().get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return { ok: false, error: 'Invalid CSRF token' }
  }
  return { ok: true }
}

/** Strip HTML/script tags from user input. */
export function sanitizeString(input, maxLen = MAX_STRING_LENGTH) {
  if (input == null) return ''
  const str = String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim()
  return str.slice(0, maxLen)
}

/** Validate email format. */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.length <= 254
}

/** Prevent path traversal in file paths. */
export function sanitizePath(input) {
  if (!input || typeof input !== 'string') return ''
  return input.replace(/\.\./g, '').replace(/^\/+/, '').slice(0, 500)
}

/** SSRF guard — only allow HTTPS URLs from allowlisted hosts. */
export function isAllowedExternalUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false
  try {
    const url = new URL(urlString)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('10.') || host.startsWith('192.168.')) {
      return false
    }
    return ALLOWED_IMAGE_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

/** File upload validation. */
export function validateFileUpload({ mimeType, sizeBytes, allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], maxBytes = 10 * 1024 * 1024 }) {
  if (!mimeType || !allowedTypes.includes(mimeType)) {
    return { ok: false, error: 'File type not allowed' }
  }
  if (sizeBytes > maxBytes) {
    return { ok: false, error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)` }
  }
  return { ok: true }
}

/** Prompt injection safeguards for AI inputs. */
export function sanitizeAiPrompt(input) {
  if (!input || typeof input !== 'string') return ''
  let text = input.slice(0, MAX_PROMPT_LENGTH)
  const blockedPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/gi,
    /disregard\s+(all\s+)?prior/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /<\|im_start\|>/gi,
  ]
  for (const pattern of blockedPatterns) {
    text = text.replace(pattern, '[filtered]')
  }
  return text.trim()
}

/** Validate MongoDB ObjectId-like string IDs (DentOS uses custom string ids). */
export function isValidId(id) {
  if (!id || typeof id !== 'string') return false
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id)
}

/** Safe JSON parse with size limit. */
export async function safeJsonBody(request, maxBytes = 1024 * 1024) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > maxBytes) {
    return { ok: false, error: 'Request body too large' }
  }
  try {
    const body = await request.json()
    return { ok: true, body }
  } catch {
    return { ok: false, error: 'Invalid JSON body' }
  }
}

/** Secure CORS origin check. */
export function getCorsOrigin(requestOrigin) {
  const allowed = process.env.CORS_ORIGINS
  if (!allowed || allowed === '*') {
    return process.env.NODE_ENV === 'production' ? null : '*'
  }
  const list = allowed.split(',').map(o => o.trim())
  if (requestOrigin && list.includes(requestOrigin)) return requestOrigin
  return list[0] || null
}
