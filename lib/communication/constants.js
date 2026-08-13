/** Provider-agnostic communication module — constants. */

export const MESSAGE_TYPES = {
  APPOINTMENT_CONFIRMATION: 'appointment_confirmation',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  FOLLOW_UP_REMINDER: 'follow_up_reminder',
  VISIT_SUMMARY: 'visit_summary',
  DOCTOR_DAILY_SCHEDULE: 'doctor_daily_schedule',
}

export const MESSAGE_STATUSES = {
  QUEUED: 'queued',
  SCHEDULED: 'scheduled',
  PROCESSING: 'processing',
  ACTION_REQUIRED: 'action_required',
  ACCEPTED: 'accepted',
  SENT: 'sent',
  RETRY_SCHEDULED: 'retry_scheduled',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
}

export const PROVIDER_OUTCOMES = {
  ACCEPTED: 'accepted',
  ACTION_REQUIRED: 'action_required',
  RETRYABLE_FAILURE: 'retryable_failure',
  REJECTED: 'rejected',
}

export const PROVIDER_KEYS = {
  MOCK: 'mock',
  CLICK_TO_WHATSAPP: 'click_to_whatsapp',
  WHATSAPP_CLOUD: 'whatsapp_cloud',
}

export const CHANNELS = {
  WHATSAPP: 'whatsapp',
}

export const CANCELABLE_STATUSES = [
  MESSAGE_STATUSES.QUEUED,
  MESSAGE_STATUSES.SCHEDULED,
  MESSAGE_STATUSES.ACTION_REQUIRED,
]

export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

export const DEFAULT_REMINDER_OFFSETS = [
  { key: '1d', offset_hours: 24 },
  { key: '2h', offset_hours: 2 },
]

export const DEFAULT_TEMPLATES = {
  appointment_confirmation: 'Hi {{patient_name}}, your appointment at {{clinic_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.',
  appointment_reminder: 'Hi {{patient_name}}, reminder: your appointment at {{clinic_name}} is on {{appointment_date}} at {{appointment_time}}.',
  follow_up_reminder: 'Hi {{patient_name}}, your follow-up at {{clinic_name}} is due on {{follow_up_date}}. Please call us to schedule.',
  visit_summary: 'Hi {{patient_name}}, thank you for visiting {{clinic_name}}. View your visit documents securely: {{secure_link}}',
  doctor_daily_schedule: 'Good morning {{doctor_name}}. Your schedule for {{schedule_date}} at {{clinic_name}}:\n{{schedule_lines}}',
}

export const WHATSAPP_POLICY_VERSION = '2026-08-11'

export const PROCESSING_LEASE_MS = 5 * 60 * 1000

export const UNSENT_MESSAGE_STATUSES = [
  MESSAGE_STATUSES.QUEUED,
  MESSAGE_STATUSES.SCHEDULED,
  MESSAGE_STATUSES.PROCESSING,
  MESSAGE_STATUSES.ACTION_REQUIRED,
  MESSAGE_STATUSES.RETRY_SCHEDULED,
]
