export {
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
  PROVIDER_OUTCOMES,
  PROVIDER_KEYS,
  CHANNELS,
  CANCELABLE_STATUSES,
  DEFAULT_TIMEZONE,
  DEFAULT_REMINDER_OFFSETS,
  DEFAULT_TEMPLATES,
  WHATSAPP_POLICY_VERSION,
  PROCESSING_LEASE_MS,
  UNSENT_MESSAGE_STATUSES,
} from './constants.js'

export {
  isValidE164,
  normalizeToE164,
  toWaMeDigits,
  buildWhatsAppUrl,
} from './phone.js'

export {
  createProvider,
  getProviderConfig,
  getProviderForClinic,
  ensureDefaultProviderConfig,
} from './registry.js'

export {
  getPatientPreferences,
  getClinicianPreferences,
  isWhatsAppOptedIn,
  isClinicianScheduleOptedIn,
  assertWhatsAppOptIn,
  setWhatsAppOptIn,
  setWhatsAppOptOut,
  setClinicianScheduleOptIn,
  cancelUnsentPatientMessages,
} from './consent.js'

export { guardCommunication, COMMUNICATION_PERMISSIONS } from './guards.js'

export { safeCommunicationMetadata, redactPhone, redactUrl, redactMessageBody } from './redact.js'

export {
  ensureVisitShareToken,
  buildVisitSummaryPublicUrl,
  isShareTokenValid,
} from './secure-links.js'

export {
  renderTemplate,
  resolveTemplateBody,
  buildVisitSummaryVars,
} from './templates.js'

export {
  initialStatus,
  statusFromOutcome,
  canMarkSent,
  canCancel,
  isRetryableFailure,
  NON_RETRYABLE_FAILURE_REASONS,
  RETRYABLE_FAILURE_REASONS,
} from './state.js'

export {
  recordCommunicationEvent,
  recordMessageAttempt,
} from './events.js'

export {
  claimMessageForProcessing,
  getWhatsAppUrl,
  resolveWhatsAppUrl,
  assertPatientConsentForProcessing,
  cleanDoc,
} from './processing.js'

export {
  createMessage,
  processMessage,
  listMessages,
  recordMessageOpened,
  markMessageSent,
  cancelMessage,
  cancelUnsentAppointmentMessages,
  processDueMessages,
  systemProfile,
} from './messages.js'

export {
  getClinicDateIso,
  getClinicLocalHourMinute,
  reminderScheduledAt,
} from './timezone.js'

export {
  onAppointmentCreated,
  onAppointmentConfirmed,
  scheduleAppointmentReminders,
  onFollowupAssigned,
  onVisitCompleted,
  scheduleDoctorDailySchedules,
  runDoctorDailyScheduleIfDue,
} from './workflows.js'

export { processCommunicationScheduler } from './scheduler.js'

export { MockProvider } from './providers/mock.js'
export { ClickToWhatsAppProvider } from './providers/click-to-whatsapp.js'
export { WhatsAppCloudProvider } from './providers/whatsapp-cloud.js'
