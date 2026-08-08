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

function safeOAuthDebugError(e) {
  const msg = e instanceof Error ? e.message : String(e)
  if (/client_secret|password|access_token|refresh_token|api_key/i.test(msg)) return 'redacted_error'
  return msg.slice(0, 120)
}

function agentLog(location, message, data, hypothesisId) {
  // #region agent log
  fetch('http://127.0.0.1:7366/ingest/f3641e0b-1a49-4955-8e0b-16987fcc4471', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '87f42d' },
    body: JSON.stringify({
      sessionId: '87f42d',
      location,
      message,
      data,
      timestamp: Date.now(),
      hypothesisId,
    }),
  }).catch(() => {})
  // #endregion
}

function loginErrorRedirect(origin, message, debug) {
  const url = new URL('/login', origin)
  url.searchParams.set('oauth_error', message)
  if (debug) {
    url.searchParams.set('oauth_debug', `${debug.step}:${debug.detail || 'unknown'}`)
  }
  const res = NextResponse.redirect(url)
  if (debug) {
    res.headers.set('X-Google-OAuth-Callback-Debug', JSON.stringify(debug))
  }
  return res
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
    agentLog(
      'callback/route.js:oauthError',
      'Google returned oauth error param',
      { oauthError, host: new URL(request.url).host },
      'H5'
    )
    return loginErrorRedirect(origin, 'Google sign-in was cancelled or denied', {
      step: 'google_denied',
      detail: oauthError,
    })
  }

  const savedState = consumeOAuthStateCookie()
  const stateOk = !!(code && state && savedState && state === savedState)
  agentLog(
    'callback/route.js:stateCheck',
    'OAuth callback state check',
    {
      host: new URL(request.url).host,
      hasCode: !!code,
      hasState: !!state,
      hasSavedState: !!savedState,
      stateOk,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'default_apex',
    },
    'H4'
  )
  if (!stateOk) {
    return loginErrorRedirect(origin, 'Invalid Google sign-in session. Please try again.', {
      step: 'state_mismatch',
      detail: `hasCode=${!!code},hasSavedState=${!!savedState}`,
    })
  }

  try {
    agentLog('callback/route.js:tokenExchange', 'Starting token exchange', { host: new URL(request.url).host }, 'H1')
    const tokens = await exchangeCodeForTokens(code)
    agentLog(
      'callback/route.js:tokenExchange',
      'Token exchange succeeded',
      { hasAccessToken: !!tokens?.access_token },
      'H1'
    )
    const googleUser = await fetchGoogleUserInfo(tokens.access_token)
    agentLog(
      'callback/route.js:userinfo',
      'Google userinfo fetched',
      { hasEmail: !!googleUser?.email, emailVerified: googleUser?.email_verified === true },
      'H2'
    )

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

      agentLog(
        'callback/route.js:session',
        'Issuing clinic session for existing profile',
        { profileId: profile.id, isPlatformAdmin: isPlatformAdminProfile(profile) },
        'H3'
      )
      const { onboarding_complete, token } = await issueClinicSession(db, profile, {
        attachCookie: false,
      })
      agentLog(
        'callback/route.js:session',
        'Clinic session issued',
        { onboarding_complete },
        'H3'
      )
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
    const detail = safeOAuthDebugError(e)
    agentLog(
      'callback/route.js:catch',
      'OAuth callback failed',
      { detail, host: new URL(request.url).host },
      'H1'
    )
    return loginErrorRedirect(origin, 'Google sign-in failed. Please try again.', {
      step: 'catch',
      detail,
    })
  }
}
