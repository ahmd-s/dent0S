import { NextResponse } from 'next/server'
import {
  generateOAuthState,
  buildGoogleAuthUrl,
  googleClientId,
  googleClientSecret,
  isGoogleOAuthConfigured,
} from '@/lib/google-oauth'
import { setOAuthStateCookie } from '@/lib/google-oauth-cookies'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const origin = new URL(request.url).origin
  if (!isGoogleOAuthConfigured()) {
    const idPresent = !!googleClientId()
    const secretPresent = !!googleClientSecret()
    let oauthError = 'google_not_configured'
    if (idPresent && !secretPresent) oauthError = 'google_missing_secret'
    else if (!idPresent && secretPresent) oauthError = 'google_missing_client_id'
    return NextResponse.redirect(new URL(`/login?oauth_error=${oauthError}`, origin))
  }
  try {
    const state = generateOAuthState()
    setOAuthStateCookie(state)
    return NextResponse.redirect(buildGoogleAuthUrl(state))
  } catch (e) {
    console.error('Google OAuth start error:', e)
    return NextResponse.redirect(
      new URL('/login?oauth_error=google_not_configured', origin)
    )
  }
}
