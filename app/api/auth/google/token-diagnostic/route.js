import { NextResponse } from 'next/server'
import { probeGoogleOAuthCredentials } from '@/lib/google-oauth'

export const dynamic = 'force-dynamic'

/** Safe runtime probe for Google OAuth credentials (fake code → Google token endpoint). */
export async function GET() {
  const result = await probeGoogleOAuthCredentials()
  return NextResponse.json({
    ok: result.ok,
    ...result,
    interpretation: result.ok
      ? 'credentials_and_redirect_uri_ok'
      : result.likelyClientIdCopiedAsSecret
        ? 'client_id_copied_as_secret'
        : result.reason === 'invalid_client'
          ? 'bad_client_id_or_secret'
          : result.reason === 'redirect_uri_mismatch'
            ? 'redirect_uri_not_registered'
            : result.reason,
  })
}
