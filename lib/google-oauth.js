import crypto from 'crypto'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function assertGoogleOAuthConfigured() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')
  }
}

export function getRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    'https://dent-os.in/api/auth/google/callback'
  )
}

export function generateOAuthState() {
  return crypto.randomBytes(32).toString('base64url')
}

export function buildGoogleAuthUrl(state) {
  assertGoogleOAuthConfigured()
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code) {
  assertGoogleOAuthConfigured()
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Token exchange failed')
  }
  return data
}

export async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Userinfo failed')
  }
  return data
}
