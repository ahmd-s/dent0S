import crypto from 'crypto'
import { generateSecret, generateURI, verifySync } from 'otplib'
import QRCode from 'qrcode'
import {
  signToken,
  verifyToken,
  setAuthCookie,
  PLATFORM_ADMIN_SESSION,
  PLATFORM_ADMIN_SESSION_SECONDS,
} from '@/lib/auth'

const PENDING_EXPIRY = '5m'
const TOTP_ISSUER = 'Connec8 DentOS'

function getEncryptionKey() {
  const raw = process.env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY
  if (!raw) throw new Error('PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY env var is not set')
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== 32) throw new Error('PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return buf
}

export function encryptTotpSecret(secret) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decryptTotpSecret(encValue) {
  if (!encValue) return null
  const key = getEncryptionKey()
  const [ivHex, tagHex, dataHex] = encValue.split(':')
  if (!ivHex || !tagHex || !dataHex) return null
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return dec.toString('utf8')
}

export function issuePendingToken(uid) {
  return signToken({ uid, purpose: 'platform_2fa_pending' }, PENDING_EXPIRY)
}

export function verifyPendingToken(token) {
  const payload = verifyToken(token)
  if (!payload || payload.purpose !== 'platform_2fa_pending' || !payload.uid) return null
  return payload
}

export function generateTotpSecret() {
  return generateSecret()
}

export function buildOtpAuthUri(email, secret) {
  return generateURI({ issuer: TOTP_ISSUER, label: email, secret })
}

export async function buildQrDataUrl(otpauthUri) {
  return QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 })
}

export function verifyTotpCode(secret, code) {
  if (!secret || !code) return false
  return verifySync({ secret, token: String(code).trim() })
}

export function issuePlatformAdminSession(profile) {
  const token = signToken(
    { uid: profile.id, cid: null, role: profile.role, pa: true },
    PLATFORM_ADMIN_SESSION
  )
  setAuthCookie(token, PLATFORM_ADMIN_SESSION_SECONDS)
  return token
}
