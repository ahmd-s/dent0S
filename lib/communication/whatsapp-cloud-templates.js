import { MESSAGE_TYPES } from './constants.js'

/**
 * Meta WhatsApp template catalog DentOS will send once a WABA is connected.
 * Create these exact names (or override via env / clinic settings) in WhatsApp Manager.
 *
 * Body copy must match Meta-approved templates. Variables are positional {{1}}…
 */
export const CLOUD_TEMPLATE_CATALOG = {
  [MESSAGE_TYPES.APPOINTMENT_CONFIRMATION]: {
    name: 'dentos_appointment_confirmation',
    language: 'en',
    bodyKeys: ['patient_name', 'clinic_name', 'appointment_date', 'appointment_time'],
    sample_body: 'Hi {{1}}, your appointment at {{2}} is confirmed for {{3}} at {{4}}.',
  },
  [MESSAGE_TYPES.APPOINTMENT_REMINDER]: {
    name: 'dentos_appointment_reminder',
    language: 'en',
    bodyKeys: ['patient_name', 'clinic_name', 'appointment_date', 'appointment_time'],
    sample_body: 'Hi {{1}}, reminder: your appointment at {{2}} is on {{3}} at {{4}}.',
  },
  [MESSAGE_TYPES.FOLLOW_UP_REMINDER]: {
    name: 'dentos_follow_up_reminder',
    language: 'en',
    bodyKeys: ['patient_name', 'clinic_name', 'follow_up_date'],
    sample_body: 'Hi {{1}}, your follow-up at {{2}} is due on {{3}}. Please call us to schedule.',
  },
  [MESSAGE_TYPES.VISIT_SUMMARY]: {
    name: 'dentos_visit_summary',
    language: 'en',
    bodyKeys: ['patient_name', 'clinic_name', 'secure_link'],
    sample_body: 'Hi {{1}}, thank you for visiting {{2}}. View your visit documents securely: {{3}}',
  },
  [MESSAGE_TYPES.DOCTOR_DAILY_SCHEDULE]: {
    name: 'dentos_doctor_daily_schedule',
    language: 'en',
    bodyKeys: ['doctor_name', 'schedule_date', 'clinic_name', 'schedule_lines'],
    sample_body: 'Good morning {{1}}. Your schedule for {{2}} at {{3}}:\n{{4}}',
  },
}

const ENV_TEMPLATE_NAME = {
  [MESSAGE_TYPES.APPOINTMENT_CONFIRMATION]: 'WHATSAPP_TEMPLATE_APPOINTMENT_CONFIRMATION',
  [MESSAGE_TYPES.APPOINTMENT_REMINDER]: 'WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER',
  [MESSAGE_TYPES.FOLLOW_UP_REMINDER]: 'WHATSAPP_TEMPLATE_FOLLOW_UP_REMINDER',
  [MESSAGE_TYPES.VISIT_SUMMARY]: 'WHATSAPP_TEMPLATE_VISIT_SUMMARY',
  [MESSAGE_TYPES.DOCTOR_DAILY_SCHEDULE]: 'WHATSAPP_TEMPLATE_DOCTOR_DAILY_SCHEDULE',
}

function textParam(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim() || '-'
  return { type: 'text', text: text.slice(0, 1024) }
}

export function resolveCloudTemplate(messageType, creds = {}) {
  const base = CLOUD_TEMPLATE_CATALOG[messageType]
  if (!base) return null

  const overrides = creds.templates?.[messageType] || {}
  const envName = process.env[ENV_TEMPLATE_NAME[messageType]]
  return {
    name: overrides.name || envName || base.name,
    language: overrides.language || creds.templateLanguage || base.language,
    bodyKeys: overrides.bodyKeys || base.bodyKeys,
    sample_body: base.sample_body,
  }
}

export function buildTemplateComponents(message, spec) {
  const vars = message.template_vars || {}
  const parameters = (spec.bodyKeys || []).map(key => textParam(vars[key]))
  return [{ type: 'body', parameters }]
}

export function buildCloudMessagePayload(message, creds, toDigits) {
  const sendMode = creds.sendMode === 'text' ? 'text' : 'template'
  if (sendMode === 'text') {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toDigits,
      type: 'text',
      text: { preview_url: true, body: String(message.body || '').slice(0, 4096) },
    }
  }

  const spec = resolveCloudTemplate(message.type, creds)
  if (!spec) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toDigits,
      type: 'text',
      text: { preview_url: true, body: String(message.body || '').slice(0, 4096) },
    }
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toDigits,
    type: 'template',
    template: {
      name: spec.name,
      language: { code: spec.language },
      components: buildTemplateComponents(message, spec),
    },
  }
}

export function listCloudTemplatesForUi(creds = {}) {
  return Object.entries(CLOUD_TEMPLATE_CATALOG).map(([type, spec]) => {
    const resolved = resolveCloudTemplate(type, creds) || spec
    return {
      type,
      name: resolved.name,
      language: resolved.language,
      body_keys: resolved.bodyKeys,
      sample_body: spec.sample_body,
    }
  })
}
