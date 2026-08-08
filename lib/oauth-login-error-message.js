/** Client-safe OAuth login error copy (no process.env). */
export function oauthLoginErrorMessage(code) {
  if (!code) return ''
  const base = code.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (base === 'google_not_configured') {
    return 'Google sign-in is not configured.'
  }
  if (base === 'google_invalid_secret') {
    return 'Google sign-in is misconfigured. GOOGLE_CLIENT_SECRET in Vercel does not match Google Cloud Console — update it and redeploy.'
  }
  if (base === 'google_secret_is_client_id') {
    return 'Google sign-in is misconfigured. GOOGLE_CLIENT_SECRET looks like the Client ID — use the separate Client secret (starts with GOCSPX-).'
  }
  if (base === 'google_redirect_uri_mismatch') {
    return 'Google sign-in is misconfigured. Add https://dent-os.in/api/auth/google/callback to Authorized redirect URIs in Google Cloud Console.'
  }
  return code
}
