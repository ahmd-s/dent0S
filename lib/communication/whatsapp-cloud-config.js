import { listCloudTemplatesForUi } from './whatsapp-cloud-templates.js'

function trim(value) {
  if (value == null) return ''
  return String(value).trim()
}

function cloudSettings(clinicSettings = {}) {
  if (clinicSettings.whatsapp_cloud && typeof clinicSettings.whatsapp_cloud === 'object') {
    return clinicSettings.whatsapp_cloud
  }
  return clinicSettings
}

export function resolveWhatsAppCloudCredentials(clinicSettings = {}) {
  const cloud = cloudSettings(clinicSettings)
  return {
    accessToken: trim(cloud.access_token) || trim(process.env.WHATSAPP_CLOUD_ACCESS_TOKEN),
    phoneNumberId: trim(cloud.phone_number_id) || trim(process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID),
    wabaId: trim(cloud.waba_id) || trim(process.env.WHATSAPP_CLOUD_WABA_ID),
    apiVersion: trim(cloud.api_version) || trim(process.env.WHATSAPP_CLOUD_API_VERSION) || 'v21.0',
    sendMode: (trim(cloud.send_mode) || trim(process.env.WHATSAPP_CLOUD_SEND_MODE) || 'template').toLowerCase(),
    templateLanguage: trim(cloud.template_language) || trim(process.env.WHATSAPP_CLOUD_TEMPLATE_LANGUAGE) || 'en',
    templates: cloud.templates && typeof cloud.templates === 'object' ? cloud.templates : {},
    graphBase: 'https://graph.facebook.com',
  }
}

export function isWhatsAppCloudConfigured(creds) {
  return Boolean(creds?.accessToken && creds?.phoneNumberId)
}

export function isWhatsAppCloudPlatformConfigured() {
  return isWhatsAppCloudConfigured(resolveWhatsAppCloudCredentials({}))
}

export function whatsappWebhookSecrets() {
  return {
    appSecret: trim(process.env.WHATSAPP_CLOUD_APP_SECRET),
    verifyToken: trim(process.env.WHATSAPP_CLOUD_VERIFY_TOKEN),
  }
}

export function maskSecret(value) {
  if (!value) return null
  const s = String(value)
  if (s.length <= 4) return '••••'
  return `••••${s.slice(-4)}`
}

export function publicWhatsAppCloudStatus(clinicSettings = {}, { appUrl } = {}) {
  const creds = resolveWhatsAppCloudCredentials(clinicSettings)
  const configured = isWhatsAppCloudConfigured(creds)
  const base = appUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
  return {
    configured,
    ready_to_auto_send: configured,
    phone_number_id: creds.phoneNumberId || null,
    waba_id: creds.wabaId || null,
    access_token_set: Boolean(creds.accessToken),
    access_token_hint: maskSecret(creds.accessToken),
    send_mode: creds.sendMode,
    api_version: creds.apiVersion,
    template_language: creds.templateLanguage,
    webhook_path: '/api/webhooks/whatsapp',
    webhook_url: base ? `${String(base).replace(/\/$/, '')}/api/webhooks/whatsapp` : '/api/webhooks/whatsapp',
    verify_token_set: Boolean(whatsappWebhookSecrets().verifyToken),
    app_secret_set: Boolean(whatsappWebhookSecrets().appSecret),
    templates: listCloudTemplatesForUi(creds),
  }
}
