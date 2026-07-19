import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import {
  verifyPendingToken,
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  buildOtpAuthUri,
  buildQrDataUrl,
} from '@/lib/platform-admin-auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function POST(request) {
  try {
    const b = await request.json()
    const pending = verifyPendingToken(b.pending_token)
    if (!pending) return notFound()

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({
      id: pending.uid,
      is_platform_admin: true,
    })
    if (!profile || profile.totp_enabled) return notFound()

    let secret = decryptTotpSecret(profile.totp_pending_secret_enc)
    if (!secret) {
      secret = generateTotpSecret()
      await db.collection('profiles').updateOne(
        { id: profile.id },
        { $set: { totp_pending_secret_enc: encryptTotpSecret(secret) } }
      )
    }

    const otpauthUri = buildOtpAuthUri(profile.email, secret)
    const qrDataUrl = await buildQrDataUrl(otpauthUri)
    return json({ ok: true, qr_data_url: qrDataUrl })
  } catch (e) {
    console.error('Setup TOTP error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
