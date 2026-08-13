import { PROVIDER_KEYS } from './constants.js'
import { MockProvider } from './providers/mock.js'
import { ClickToWhatsAppProvider } from './providers/click-to-whatsapp.js'
import { WhatsAppCloudProvider } from './providers/whatsapp-cloud.js'

const PROVIDER_FACTORIES = {
  [PROVIDER_KEYS.MOCK]: () => new MockProvider(),
  [PROVIDER_KEYS.CLICK_TO_WHATSAPP]: () => new ClickToWhatsAppProvider(),
  [PROVIDER_KEYS.WHATSAPP_CLOUD]: (config) => new WhatsAppCloudProvider(config),
}

export function createProvider(providerKey, config = {}) {
  const factory = PROVIDER_FACTORIES[providerKey]
  if (!factory) {
    throw new Error(`Unknown communication provider: ${providerKey}`)
  }
  return factory(config)
}

export async function getProviderConfig(db, clinicId) {
  const doc = await db.collection('provider_configs').findOne({ clinic_id: clinicId })
  return doc || null
}

export async function getProviderForClinic(db, clinicId) {
  const config = await getProviderConfig(db, clinicId)
  const providerKey = config?.provider_key
    || (process.env.COMMUNICATION_DEFAULT_PROVIDER === 'mock' ? PROVIDER_KEYS.MOCK : PROVIDER_KEYS.CLICK_TO_WHATSAPP)

  return {
    provider: createProvider(providerKey, config?.settings || {}),
    config: config || { clinic_id: clinicId, provider_key: providerKey, settings: {} },
  }
}

export async function ensureDefaultProviderConfig(db, clinicId) {
  const existing = await getProviderConfig(db, clinicId)
  if (existing) return existing

  const defaultKey = process.env.COMMUNICATION_DEFAULT_PROVIDER === 'mock'
    ? PROVIDER_KEYS.MOCK
    : PROVIDER_KEYS.CLICK_TO_WHATSAPP

  const doc = {
    clinic_id: clinicId,
    provider_key: defaultKey,
    settings: {
      timezone: process.env.COMMUNICATION_DEFAULT_TIMEZONE || 'Asia/Kolkata',
      reminder_offsets: [
        { key: '1d', offset_hours: 24 },
        { key: '2h', offset_hours: 2 },
      ],
      doctor_schedule_hour: 7,
      doctor_schedule_minute: 0,
    },
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  }
  await db.collection('provider_configs').insertOne(doc)
  return doc
}
