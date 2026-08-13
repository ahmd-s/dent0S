import { PROVIDER_KEYS, PROVIDER_OUTCOMES } from '../constants.js'

/**
 * Placeholder for WhatsApp Business Cloud API.
 * Wire credentials and HTTP calls here when enabling Cloud API — no changes
 * required in appointment/billing/follow-up business logic.
 */
export class WhatsAppCloudProvider {
  constructor(_config = {}) {
    this.key = PROVIDER_KEYS.WHATSAPP_CLOUD
  }

  async send(_message) {
    return {
      outcome: PROVIDER_OUTCOMES.REJECTED,
      provider_key: this.key,
      detail: {
        reason: 'whatsapp_cloud_not_configured',
        message: 'WhatsApp Cloud API provider is not enabled yet.',
      },
    }
  }
}
