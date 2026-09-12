import { PROVIDER_KEYS } from './constants.js'
import { MockProvider } from './providers/mock.js'
import { ClickToWhatsAppProvider } from './providers/click-to-whatsapp.js'
import { WhatsAppCloudProvider } from './providers/whatsapp-cloud.js'
import { isWhatsAppCloudConfigured, resolveWhatsAppCloudCredentials } from './whatsapp-cloud-config.js'

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

/**
 * Cloud API is used automatically once credentials exist (env or clinic settings).
 * Until then, clinics stay on click-to-WhatsApp so booking/visit messages still queue.
 */
export function resolveProviderKey(config) {
  if (process.env.COMMUNICATION_DEFAULT_PROVIDER === 'mock') return PROVIDER_KEYS.MOCK
  const settings = config?.settings || {}
  if (settings.force_click_to_whatsapp === true) return PROVIDER_KEYS.CLICK_TO_WHATSAPP
  const creds = resolveWhatsAppCloudCredentials(settings)
  if (isWhatsAppCloudConfigured(creds)) return PROVIDER_KEYS.WHATSAPP_CLOUD
  if (config?.provider_key === PROVIDER_KEYS.MOCK) return PROVIDER_KEYS.MOCK
  return PROVIDER_KEYS.CLICK_TO_WHATSAPP
}

export async function getProviderForClinic(db, clinicId) {
  const config = await getProviderConfig(db, clinicId)
  const settings = config?.settings || {}
  const providerKey = resolveProviderKey(config)

  return {
    provider: createProvider(providerKey, settings),
    config: {
      clinic_id: clinicId,
      ...(config || {}),
      provider_key: providerKey,
      settings,
    },
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
      whatsapp_cloud: {
        access_token: '',
        phone_number_id: '',
        waba_id: '',
        send_mode: 'template',
        template_language: 'en',
      },
    },
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  }
  await db.collection('provider_configs').insertOne(doc)
  return doc
}

export async function saveProviderCloudCredentials(db, clinicId, patch = {}) {
  const existing = await ensureDefaultProviderConfig(db, clinicId)
  const currentCloud = existing.settings?.whatsapp_cloud || {}
  const nextCloud = { ...currentCloud }

  if (patch.clear_credentials) {
    nextCloud.access_token = ''
    nextCloud.phone_number_id = ''
    nextCloud.waba_id = ''
  } else {
    if (typeof patch.phone_number_id === 'string') nextCloud.phone_number_id = patch.phone_number_id.trim()
    if (typeof patch.waba_id === 'string') nextCloud.waba_id = patch.waba_id.trim()
    if (typeof patch.send_mode === 'string') nextCloud.send_mode = patch.send_mode.trim().toLowerCase()
    if (typeof patch.template_language === 'string') nextCloud.template_language = patch.template_language.trim()
    if (typeof patch.access_token === 'string' && patch.access_token.trim()) {
      nextCloud.access_token = patch.access_token.trim()
    }
  }

  const settings = {
    ...(existing.settings || {}),
    whatsapp_cloud: nextCloud,
  }
  if (typeof patch.force_click_to_whatsapp === 'boolean') {
    settings.force_click_to_whatsapp = patch.force_click_to_whatsapp
  }

  await db.collection('provider_configs').updateOne(
    { clinic_id: clinicId },
    {
      $set: {
        settings,
        updated_at: new Date(),
      },
    }
  )

  return getProviderConfig(db, clinicId)
}
