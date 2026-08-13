import { PROVIDER_KEYS, PROVIDER_OUTCOMES } from '../constants.js'

export class MockProvider {
  constructor() {
    this.key = PROVIDER_KEYS.MOCK
  }

  async send(message) {
    return {
      outcome: PROVIDER_OUTCOMES.ACCEPTED,
      provider_key: this.key,
      detail: {
        simulated: true,
        recipient: message.recipient_e164,
        body_length: (message.body || '').length,
      },
    }
  }
}
