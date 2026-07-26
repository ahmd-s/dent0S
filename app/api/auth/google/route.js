import { NextResponse } from 'next/server'
import {
  generateOAuthState,
  buildGoogleAuthUrl,
} from '@/lib/google-oauth'
import { isGoogleOAuthConfigured } from '@/lib/google-oauth'
import { setOAuthStateCookie } from '@/lib/google-oauth-cookies'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const origin = new URL(request.url).origin
  if (!isGoogleOAuthConfigured()) {
    console.error(
      'Google OAuth start: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET at runtime'
    )
    return NextResponse.redirect(
      new URL('/login?oauth_error=google_not_configured', origin)
    )
  }
  try {
    const state = generateOAuthState()
    setOAuthStateCookie(state)
    return NextResponse.redirect(buildGoogleAuthUrl(state))
  } catch (e) {
    console.error('Google OAuth start error:', e)
    const message = encodeURIComponent('Google sign-in failed. Please try again.')
    return NextResponse.redirect(new URL(`/login?oauth_error=${message}`, origin))
  }
}
