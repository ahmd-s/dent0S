/** Client-safe OAuth login error copy (no process.env). */
export function oauthLoginErrorMessage(code) {
  if (!code) return ''
  const base = code.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (base === 'google_not_configured') {
    return 'Google sign-in is not configured.'
  }
  if (base === 'google_missing_secret') {
    return 'Google sign-in is not configured. Add GOOGLE_CLIENT_SECRET (GOCSPX-...) in Vercel Production and redeploy.'
  }
  if (base === 'google_missing_client_id') {
    return 'Google sign-in is not configured. Add GOOGLE_CLIENT_ID in Vercel Production and redeploy.'
  }
  return code
}
