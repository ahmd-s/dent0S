import crypto from 'crypto'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() || ''
}

function googleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || ''
}

export { googleClientId, googleClientSecret }

export function isGoogleOAuthConfigured() {
  return Boolean(googleClientId() && googleClientSecret())
}

export function assertGoogleOAuthConfigured() {
  if (!googleClientId() || !googleClientSecret()) {
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
    client_id: googleClientId(),
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
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
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
    const errorCode = data.error || 'token_exchange_failed'
    const detail = data.error_description || errorCode
    throw new Error(`${errorCode}: ${detail}`)
  }
  return data
}

export async function probeGoogleOAuthCredentials() {
  const clientId = googleClientId()
  const clientSecret = googleClientSecret()
  const redirectUri = getRedirectUri()

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      reason: 'missing_env',
      clientIdPresent: !!clientId,
      clientSecretPresent: !!clientSecret,
      redirectUri,
    }
  }

  const body = new URLSearchParams({
    code: 'credential_probe_fake_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()
  const googleError = data.error || null

  if (googleError === 'invalid_grant') {
    return {
      ok: true,
      reason: 'credentials_ok',
      redirectUri,
      clientIdLength: clientId.length,
      clientSecretLength: clientSecret.length,
    }
  }

  const sameLengthAsClientId =
    clientId.length === clientSecret.length && clientSecret === clientId

  return {
    ok: false,
    reason: googleError || 'probe_failed',
    googleErrorDescription: data.error_description || null,
    redirectUri,
    clientIdLength: clientId.length,
    clientSecretLength: clientSecret.length,
    likelyClientIdCopiedAsSecret: sameLengthAsClientId,
  }
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
