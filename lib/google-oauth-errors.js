/** Map ?error= query codes/messages from OAuth redirects to user-facing copy. */
export function oauthLoginErrorMessage(errorParam) {
  if (!errorParam) return ''
  if (errorParam === 'google_not_configured') {
    return 'Google sign-in is not configured.'
  }
  return errorParam
}

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}
