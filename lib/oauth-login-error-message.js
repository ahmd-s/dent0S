/** Client-safe OAuth login error copy (no process.env). */
export function oauthLoginErrorMessage(code) {
  if (!code) return ''
  if (code === 'google_not_configured') {
    return 'Google sign-in is not configured.'
  }
  return code
}
