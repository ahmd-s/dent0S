import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
} from '@/lib/google-oauth'
import {
  consumeOAuthStateCookie,
  buildGoogleSignupPendingToken,
  GOOGLE_SIGNUP_PENDING_COOKIE,
  GOOGLE_PA_PENDING_COOKIE,
} from '@/lib/google-oauth-cookies'
import { issueClinicSession } from '@/lib/clinic-session'
import { isPlatformAdminProfile } from '@/lib/platform-admin'
import { issuePendingToken } from '@/lib/platform-admin-auth'

export const dynamic = 'force-dynamic'

const AUTH_COOKIE = 'dentos_token'
const AUTH_MAX_AGE = 60 * 60 * 24 * 30

function sessionCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
    ...(process.env.NODE_ENV === 'production' ? { domain: '.dent-os.in' } : {}),
  }
}

function redirectWithCookie(origin, path, name, value, maxAge) {
  const res = NextResponse.redirect(new URL(path, origin))
  res.cookies.set(name, value, sessionCookieOptions(maxAge))
  return res
}

function loginErrorRedirect(origin, message) {
  return NextResponse.redirect(
    new URL(`/login?oauth_error=${encodeURIComponent(message)}`, origin)
  )
}

async function applyGoogleProfileUpdates(db, profile, googleSub) {
  const $set = { google_sub: googleSub }
  const $unset = {}
  if (profile.email_verified === false) {
    $set.email_verified = true
    $unset.email_verification_token_hash = ''
    $unset.email_verification_expires_at = ''
  }
  await db.collection('profiles').updateOne(
    { id: profile.id },
    { $set, ...(Object.keys($unset).length ? { $unset } : {}) }
  )
  return db.collection('profiles').findOne({ id: profile.id })
}

export async function GET(request) {
  const origin = new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return loginErrorRedirect(origin, 'Google sign-in was cancelled or denied')
  }

  const savedState = consumeOAuthStateCookie()
  if (!code || !state || !savedState || state !== savedState) {
    return loginErrorRedirect(origin, 'Invalid Google sign-in session. Please try again.')
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const googleUser = await fetchGoogleUserInfo(tokens.access_token)

    if (!googleUser.email || googleUser.email_verified !== true) {
      return loginErrorRedirect(origin, 'Google account email is not verified')
    }

    const email = googleUser.email.toLowerCase().trim()
    const googleSub = googleUser.sub
    const fullName = googleUser.name || email.split('@')[0]

    const db = await getDb()
    let profile = await db.collection('profiles').findOne({ email })

    if (profile) {
      if (!profile.is_active || profile.deleted_at) {
        return loginErrorRedirect(origin, 'Invalid credentials')
      }

      if (profile.google_sub && profile.google_sub !== googleSub) {
        return loginErrorRedirect(origin, 'This email is linked to a different Google account')
      }

      profile = await applyGoogleProfileUpdates(db, profile, googleSub)

      if (isPlatformAdminProfile(profile)) {
        const pendingToken = issuePendingToken(profile.id)
        const paValue = JSON.stringify({
          pending_token: pendingToken,
          setup_required: !profile.totp_enabled,
        })
        return redirectWithCookie(
          origin,
          '/login?google_platform_admin=1',
          GOOGLE_PA_PENDING_COOKIE,
          paValue,
          60 * 5
        )
      }

      const { onboarding_complete, token } = await issueClinicSession(db, profile, {
        attachCookie: false,
      })
      return redirectWithCookie(
        origin,
        onboarding_complete ? '/dashboard' : '/onboarding',
        AUTH_COOKIE,
        token,
        AUTH_MAX_AGE
      )
    }

    const signupToken = buildGoogleSignupPendingToken({
      email,
      full_name: fullName,
      google_sub: googleSub,
    })
    return redirectWithCookie(
      origin,
      '/signup/google-complete',
      GOOGLE_SIGNUP_PENDING_COOKIE,
      signupToken,
      60 * 15
    )
  } catch (e) {
    console.error('Google OAuth callback error:', e)
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('invalid_client')) {
      return loginErrorRedirect(
        origin,
        'Google sign-in is misconfigured (invalid client secret).'
      )
    }
    return loginErrorRedirect(origin, 'Google sign-in failed. Please try again.')
  }
}
