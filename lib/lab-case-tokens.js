import crypto from 'crypto'

/**
 * Server-only. Kept out of lib/lab-case-helpers.js because that module is
 * imported by client components — pulling `crypto` in there makes webpack
 * bundle the Node crypto polyfill (~320 KB) into the browser.
 */
export function secureToken() {
  return crypto.randomBytes(24).toString('base64url')
}
