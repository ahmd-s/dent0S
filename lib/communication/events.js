import { v4 as uuidv4 } from 'uuid'
import { logActivity } from '../activity-helpers.js'
import { ACTIVITY_EVENTS } from '../activity-event-registry.js'
import { safeCommunicationMetadata, redactPhone } from './redact.js'

const EVENT_ACTIVITY_MAP = {
  message_created: ACTIVITY_EVENTS.MESSAGE_SENT,
  message_scheduled: ACTIVITY_EVENTS.MESSAGE_SENT,
  message_action_required: ACTIVITY_EVENTS.MESSAGE_SENT,
  message_opened: ACTIVITY_EVENTS.MESSAGE_SENT,
  message_sent: ACTIVITY_EVENTS.MESSAGE_SENT,
  message_failed: ACTIVITY_EVENTS.MESSAGE_FAILED,
  message_cancelled: ACTIVITY_EVENTS.MESSAGE_CANCELLED,
}

export async function recordCommunicationEvent(db, profile, message, eventType, metadata = {}) {
  const now = new Date()
  const eventDoc = {
    id: uuidv4(),
    clinic_id: message.clinic_id,
    message_id: message.id,
    event_type: eventType,
    message_type: message.type,
    message_status: message.status,
    patient_id: message.patient_id || null,
    metadata: safeCommunicationMetadata({
      provider_key: message.provider_key || null,
      ...metadata,
    }),
    created_at: now,
  }

  try {
    await db.collection('communication_events').insertOne(eventDoc)
  } catch {
    /* best-effort */
  }

  const activityEvent = EVENT_ACTIVITY_MAP[eventType]
  if (activityEvent && profile) {
    try {
      await logActivity(db, profile, activityEvent, {
        patientId: message.patient_id || null,
        appointmentId: message.appointment_id || null,
        visitId: message.visit_id || null,
        metadata: {
          message_id: message.id,
          type: message.type,
          event_type: eventType,
          status: message.status,
        },
      })
    } catch {
      /* best-effort */
    }
  }

  return eventDoc
}

export async function recordMessageAttempt(db, message, providerResult, attemptNumber = 1) {
  const detail = { ...(providerResult.detail || {}) }
  if (detail.whatsapp_url) {
    detail.whatsapp_url_present = true
    delete detail.whatsapp_url
  }

  const attempt = {
    id: uuidv4(),
    clinic_id: message.clinic_id,
    message_id: message.id,
    attempt_number: attemptNumber,
    provider_key: providerResult.provider_key,
    outcome: providerResult.outcome,
    detail,
    recipient_e164: redactPhone(message.recipient_e164),
    created_at: new Date(),
  }

  await db.collection('message_attempts').insertOne(attempt)
  return attempt
}
