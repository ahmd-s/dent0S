import { NextResponse } from 'next/server'
import { getRedirectUri, googleClientId, googleClientSecret } from '@/lib/google-oauth'

export const dynamic = 'force-dynamic'

/**
 * Safe runtime probe: POST a fake code to Google's token endpoint.
 * invalid_grant => client_id, secret, and redirect_uri are accepted.
 */
export async function GET() {
  const clientId = googleClientId()
  const clientSecret = googleClientSecret()
  const redirectUri = getRedirectUri()

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      ok: false,
      step: 'env',
      clientIdPresent: !!clientId,
      clientSecretPresent: !!clientSecret,
      redirectUri,
    })
  }

  const body = new URLSearchParams({
    code: 'diagnostic_fake_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()

  return NextResponse.json({
    ok: data.error === 'invalid_grant',
    httpStatus: res.status,
    googleError: data.error || null,
    googleErrorDescription: data.error_description || null,
    redirectUri,
    clientIdLength: clientId.length,
    clientSecretLength: clientSecret.length,
    interpretation:
      data.error === 'invalid_grant'
        ? 'credentials_and_redirect_uri_ok'
        : data.error === 'invalid_client'
          ? 'bad_client_id_or_secret'
          : data.error === 'redirect_uri_mismatch'
            ? 'redirect_uri_not_registered'
            : 'unknown',
  })
}
