import crypto from 'crypto'
import { MESSAGE_STATUSES } from './constants.js'
import { whatsappWebhookSecrets } from './whatsapp-cloud-config.js'

export function verifyWhatsAppSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !rawBody) return false
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const receivedHex = signatureHeader.slice('sha256='.length).trim()
  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const received = Buffer.from(receivedHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  if (received.length !== expected.length || received.length === 0) return false
  return crypto.timingSafeEqual(expected, received)
}

export function parseWhatsAppWebhookPayload(body) {
  if (!body || body.object !== 'whatsapp_business_account') {
    return { statuses: [], inbound: [] }
  }

  const statuses = []
  const inbound = []

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {}
      for (const status of value.statuses || []) {
        statuses.push({
          provider_message_id: status.id || null,
          status: status.status || null,
          timestamp: status.timestamp || null,
          recipient_id: status.recipient_id || null,
          errors: status.errors || [],
          phone_number_id: value.metadata?.phone_number_id || null,
        })
      }
      for (const msg of value.messages || []) {
        inbound.push({
          provider_message_id: msg.id || null,
          from: msg.from || null,
          type: msg.type || null,
          timestamp: msg.timestamp || null,
        })
      }
    }
  }

  return { statuses, inbound }
}

function failureReasonFromWebhook(item) {
  const first = item.errors?.[0]
  if (!first) return 'provider_failed'
  return String(first.code || first.title || 'provider_failed')
}

export async function applyWhatsAppCloudStatuses(db, statuses) {
  const results = []
  for (const item of statuses) {
    if (!item.provider_message_id || !item.status) {
      results.push({ ok: false, skipped: true, reason: 'incomplete_status' })
      continue
    }

    const message = await db.collection('messages').findOne({
      provider_message_id: item.provider_message_id,
    })
    if (!message) {
      results.push({ ok: false, skipped: true, reason: 'unknown_message' })
      continue
    }

    const now = new Date()
    const update = {
      provider_status: item.status,
      provider_status_at: now,
      updated_at: now,
    }
    let eventType = null

    if (item.status === 'failed') {
      update.status = MESSAGE_STATUSES.FAILED
      update.failure_reason = failureReasonFromWebhook(item)
      eventType = 'message_failed'
    } else if (item.status === 'sent' || item.status === 'delivered' || item.status === 'read') {
      if (message.status !== MESSAGE_STATUSES.FAILED && message.status !== MESSAGE_STATUSES.CANCELLED) {
        update.status = MESSAGE_STATUSES.SENT
        if (!message.sent_at) update.sent_at = now
        eventType = item.status === 'sent' ? 'message_sent' : 'message_provider_status'
      }
    } else {
      results.push({ ok: true, skipped: true, reason: 'ignored_status', id: message.id })
      continue
    }

    await db.collection('messages').updateOne(
      { id: message.id, clinic_id: message.clinic_id },
      { $set: update }
    )

    if (eventType) {
      try {
        const { recordCommunicationEvent } = await import('./events.js')
        await recordCommunicationEvent(
          db,
          { id: 'whatsapp_webhook', clinic_id: message.clinic_id },
          { ...message, ...update },
          eventType,
          { provider_status: item.status }
        )
      } catch {
        /* activity log is best-effort */
      }
    }

    results.push({ ok: true, id: message.id, status: update.status || message.status })
  }
  return results
}

export async function handleWhatsAppWebhookGet(url) {
  const { verifyToken } = whatsappWebhookSecrets()
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (!verifyToken) {
    return { ok: false, status: 503, error: 'WhatsApp webhook verify token is not allocated yet' }
  }
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return { ok: true, status: 200, challenge }
  }
  return { ok: false, status: 403, error: 'Webhook verification failed' }
}

export function handleWhatsAppWebhookAuth(rawBody, signatureHeader) {
  const { appSecret } = whatsappWebhookSecrets()
  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, status: 503, error: 'WhatsApp webhook app secret is not allocated yet' }
    }
    return { ok: true }
  }
  if (!verifyWhatsAppSignature(rawBody, signatureHeader, appSecret)) {
    return { ok: false, status: 403, error: 'Invalid webhook signature' }
  }
  return { ok: true }
}
