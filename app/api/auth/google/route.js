import { NextResponse } from 'next/server'
import {
  generateOAuthState,
  buildGoogleAuthUrl,
} from '@/lib/google-oauth'
import { isGoogleOAuthConfigured } from '@/lib/google-oauth'
import { setOAuthStateCookie } from '@/lib/google-oauth-cookies'

export const dynamic = 'force-dynamic'

const GOOGLE_ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']

function logGoogleOAuthEnvDiagnostic() {
  const id = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  console.info('[google-oauth-env-diagnostic]', {
    variableNamesChecked: GOOGLE_ENV_KEYS,
    GOOGLE_CLIENT_ID: { present: id != null && id !== '', length: id?.length ?? 0 },
    GOOGLE_CLIENT_SECRET: { present: secret != null && secret !== '', length: secret?.length ?? 0 },
    nodeEnv: process.env.NODE_ENV ?? '(unset)',
    vercelEnv: process.env.VERCEL_ENV ?? '(unset)',
  })
}

export async function GET(request) {
  logGoogleOAuthEnvDiagnostic()
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
