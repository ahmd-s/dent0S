import { PROVIDER_KEYS, PROVIDER_OUTCOMES } from '../constants.js'
import { isValidE164, toWaMeDigits } from '../phone.js'
import { isWhatsAppCloudConfigured, resolveWhatsAppCloudCredentials } from '../whatsapp-cloud-config.js'
import { buildCloudMessagePayload } from '../whatsapp-cloud-templates.js'

const SEND_TIMEOUT_MS = 15_000

export function mapGraphApiError(httpStatus, errorBody) {
  const err = errorBody?.error || {}
  const code = err.code
  const message = String(err.message || '')
  const lower = message.toLowerCase()

  if (httpStatus === 429 || code === 4 || code === 80007 || code === 130429) {
    return { outcome: PROVIDER_OUTCOMES.RETRYABLE_FAILURE, reason: 'rate_limit', message }
  }
  if (httpStatus >= 500 || code === 1 || code === 2) {
    return { outcome: PROVIDER_OUTCOMES.RETRYABLE_FAILURE, reason: 'server_error', message }
  }
  if (code === 190) {
    return { outcome: PROVIDER_OUTCOMES.REJECTED, reason: 'access_token_invalid', message }
  }
  if (code === 132000 || code === 132001 || code === 132005 || code === 132012 || lower.includes('template')) {
    return { outcome: PROVIDER_OUTCOMES.REJECTED, reason: 'template_not_approved', message }
  }
  if (code === 131026) {
    return { outcome: PROVIDER_OUTCOMES.REJECTED, reason: 'undeliverable', message }
  }
  if (code === 131047) {
    return { outcome: PROVIDER_OUTCOMES.REJECTED, reason: 'reengagement_required', message }
  }
  if (code === 131051) {
    return { outcome: PROVIDER_OUTCOMES.REJECTED, reason: 'unsupported_message_type', message }
  }
  if (httpStatus >= 400) {
    return { outcome: PROVIDER_OUTCOMES.REJECTED, reason: 'rejected', message }
  }
  return { outcome: PROVIDER_OUTCOMES.RETRYABLE_FAILURE, reason: 'server_error', message }
}

export class WhatsAppCloudProvider {
  constructor(settings = {}, { fetchImpl } = {}) {
    this.key = PROVIDER_KEYS.WHATSAPP_CLOUD
    this.settings = settings
    this.fetchImpl = fetchImpl || globalThis.fetch
  }

  async send(message) {
    const creds = resolveWhatsAppCloudCredentials(this.settings)
    if (!isWhatsAppCloudConfigured(creds)) {
      return {
        outcome: PROVIDER_OUTCOMES.REJECTED,
        provider_key: this.key,
        detail: {
          reason: 'whatsapp_cloud_not_configured',
          message: 'WhatsApp Cloud API credentials are not allocated yet.',
        },
      }
    }

    const phone = message.recipient_e164
    if (!isValidE164(phone)) {
      return {
        outcome: PROVIDER_OUTCOMES.REJECTED,
        provider_key: this.key,
        detail: { reason: 'invalid_e164', phone },
      }
    }

    const body = message.body || ''
    if (!String(body).trim() && creds.sendMode === 'text') {
      return {
        outcome: PROVIDER_OUTCOMES.REJECTED,
        provider_key: this.key,
        detail: { reason: 'message_body_empty' },
      }
    }

    const toDigits = toWaMeDigits(phone)
    const payload = buildCloudMessagePayload(message, creds, toDigits)
    const url = `${creds.graphBase}/${creds.apiVersion}/${creds.phoneNumberId}/messages`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const mapped = mapGraphApiError(res.status, json)
        return {
          outcome: mapped.outcome,
          provider_key: this.key,
          detail: {
            reason: mapped.reason,
            http_status: res.status,
            graph_code: json?.error?.code || null,
            message: mapped.message || null,
          },
        }
      }

      const providerMessageId = json?.messages?.[0]?.id || null
      if (!providerMessageId) {
        return {
          outcome: PROVIDER_OUTCOMES.RETRYABLE_FAILURE,
          provider_key: this.key,
          detail: { reason: 'server_error', message: 'Cloud API accepted request without a message id' },
        }
      }

      return {
        outcome: PROVIDER_OUTCOMES.ACCEPTED,
        provider_key: this.key,
        detail: {
          provider_message_id: providerMessageId,
          wa_id: json?.contacts?.[0]?.wa_id || toDigits,
          send_mode: payload.type,
        },
      }
    } catch (e) {
      const aborted = e?.name === 'AbortError' || e?.name === 'TimeoutError'
      return {
        outcome: PROVIDER_OUTCOMES.RETRYABLE_FAILURE,
        provider_key: this.key,
        detail: {
          reason: aborted ? 'timeout' : 'network_error',
          message: aborted ? 'WhatsApp Cloud API request timed out' : (e?.message || 'network_error'),
        },
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
