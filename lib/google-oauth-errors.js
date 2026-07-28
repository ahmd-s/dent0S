/** @deprecated Import from @/lib/oauth-login-error-message (client) or use isGoogleOAuthConfigured in google-oauth.js (server). */
export { oauthLoginErrorMessage } from '@/lib/oauth-login-error-message'

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}
