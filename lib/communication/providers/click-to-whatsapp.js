import { PROVIDER_KEYS, PROVIDER_OUTCOMES } from '../constants.js'
import { buildWhatsAppUrl, isValidE164 } from '../phone.js'

export class ClickToWhatsAppProvider {
  constructor() {
    this.key = PROVIDER_KEYS.CLICK_TO_WHATSAPP
  }

  async send(message) {
    const phone = message.recipient_e164
    if (!isValidE164(phone)) {
      return {
        outcome: PROVIDER_OUTCOMES.REJECTED,
        provider_key: this.key,
        detail: { reason: 'invalid_e164', phone },
      }
    }

    const body = message.body || ''
    const whatsapp_url = buildWhatsAppUrl(phone, body)

    return {
      outcome: PROVIDER_OUTCOMES.ACTION_REQUIRED,
      provider_key: this.key,
      detail: {
        whatsapp_url,
        manual_send_required: true,
        recipient_e164: phone,
      },
    }
  }
}
