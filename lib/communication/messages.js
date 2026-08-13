import { v4 as uuidv4 } from 'uuid'
import {
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
  PROVIDER_OUTCOMES,
  CANCELABLE_STATUSES,
  CHANNELS,
  PROCESSING_LEASE_MS,
  UNSENT_MESSAGE_STATUSES,
} from './constants.js'
import { statusFromOutcome, initialStatus, isRetryableFailure } from './state.js'
import { normalizeToE164, isValidE164 } from './phone.js'
import { assertWhatsAppOptIn } from './consent.js'
import { resolveTemplateBody } from './templates.js'
import { getProviderForClinic, ensureDefaultProviderConfig } from './registry.js'
import { recordCommunicationEvent, recordMessageAttempt } from './events.js'
import {
  claimMessageForProcessing,
  getWhatsAppUrl,
  assertPatientConsentForProcessing,
  cleanDoc,
} from './processing.js'

export { getWhatsAppUrl, claimMessageForProcessing, cleanDoc }

function systemProfile(clinicId) {
  return { id: 'system', clinic_id: clinicId, full_name: 'System' }
}

async function resolveRecipientE164(db, clinicId, { patientId, recipientE164, recipientPhone }) {
  if (recipientE164 && isValidE164(recipientE164)) return recipientE164
  if (recipientPhone) {
    const normalized = normalizeToE164(recipientPhone)
    if (normalized && isValidE164(normalized)) return normalized
  }
  if (patientId) {
    const patient = await db.collection('patients').findOne({
      id: patientId,
      clinic_id: clinicId,
      is_archived: { $ne: true },
    })
    if (patient?.phone) {
      const normalized = normalizeToE164(patient.phone)
      if (normalized && isValidE164(normalized)) return normalized
    }
  }
  return null
}

export async function createMessage(db, profile, opts) {
  const clinicId = profile.clinic_id
  await ensureDefaultProviderConfig(db, clinicId)

  const {
    type,
    patient_id: patientId = null,
    appointment_id: appointmentId = null,
    visit_id: visitId = null,
    invoice_id: invoiceId = null,
    doctor_id: doctorId = null,
    recipient_e164: recipientE164 = null,
    recipient_phone: recipientPhone = null,
    body: bodyOverride = null,
    template_vars: templateVars = {},
    scheduled_at: scheduledAt = null,
    idempotency_key: idempotencyKey = null,
    skip_consent: skipConsent = false,
    metadata = {},
  } = opts

  if (!type) return { ok: false, error: 'type is required' }
  if (!Object.values(MESSAGE_TYPES).includes(type)) {
    return { ok: false, error: `Unsupported message type: ${type}` }
  }

  if (idempotencyKey) {
    const existing = await db.collection('messages').findOne({
      clinic_id: clinicId,
      idempotency_key: idempotencyKey,
    })
    if (existing) {
      return { ok: true, message: cleanDoc(existing), duplicate: true }
    }
  }

  const isPatientMessage = Boolean(patientId) && type !== MESSAGE_TYPES.DOCTOR_DAILY_SCHEDULE
  if (isPatientMessage && !skipConsent) {
    const consent = await assertWhatsAppOptIn(db, clinicId, patientId)
    if (!consent.ok) return consent
  }

  const recipient = await resolveRecipientE164(db, clinicId, {
    patientId,
    recipientE164,
    recipientPhone,
  })
  if (!recipient) {
    return { ok: false, error: 'Valid E.164 recipient phone is required' }
  }

  const body = bodyOverride || await resolveTemplateBody(db, clinicId, type, templateVars)
  if (!body?.trim()) {
    return { ok: false, error: 'Message body is empty', reason: 'template_validation_failed' }
  }

  const { config } = await getProviderForClinic(db, clinicId)
  const now = new Date()
  const status = initialStatus(scheduledAt)

  const message = {
    id: uuidv4(),
    clinic_id: clinicId,
    patient_id: patientId,
    appointment_id: appointmentId,
    visit_id: visitId,
    invoice_id: invoiceId,
    doctor_id: doctorId,
    type,
    channel: CHANNELS.WHATSAPP,
    body,
    recipient_e164: recipient,
    status,
    provider_key: config.provider_key,
    scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
    idempotency_key: idempotencyKey,
    manual_send_required: config.provider_key === 'click_to_whatsapp',
    whatsapp_url: null,
    sent_by_user_id: null,
    sent_at: null,
    opened_at: null,
    opened_by_user_id: null,
    retry_count: 0,
    failure_reason: null,
    metadata,
    created_by: profile?.id || null,
    created_at: now,
    updated_at: now,
  }

  try {
    await db.collection('messages').insertOne(message)
  } catch (e) {
    if (e.code === 11000 && idempotencyKey) {
      const dup = await db.collection('messages').findOne({
        clinic_id: clinicId,
        idempotency_key: idempotencyKey,
      })
      if (dup) return { ok: true, message: cleanDoc(dup), duplicate: true }
    }
    throw e
  }

  const eventType = status === MESSAGE_STATUSES.SCHEDULED ? 'message_scheduled' : 'message_created'
  await recordCommunicationEvent(db, profile, message, eventType)

  if (status === MESSAGE_STATUSES.QUEUED) {
    const processed = await processMessage(db, profile, message.id)
    if (processed.message) message.status = processed.message.status
    if (processed.message?.whatsapp_url) message.whatsapp_url = processed.message.whatsapp_url
  }

  return { ok: true, message: cleanDoc(message) }
}

export async function processMessage(db, profile, messageId) {
  const clinicId = profile.clinic_id
  const message = await claimMessageForProcessing(db, messageId, clinicId)
  if (!message) {
    return { ok: false, error: 'Message not found, not due, or already being processed' }
  }

  const consent = await assertPatientConsentForProcessing(db, clinicId, message)
  if (!consent.ok) {
      await db.collection('messages').updateOne(
        { id: messageId, clinic_id: clinicId },
        {
          $set: {
            status: MESSAGE_STATUSES.FAILED,
            failure_reason: consent.reason || 'consent_required',
            updated_at: new Date(),
          },
        }
      )
      return { ok: false, error: consent.error, reason: consent.reason || 'consent_required' }
  }

  const { provider } = await getProviderForClinic(db, clinicId)
  const providerResult = await provider.send(message)
  let nextStatus = statusFromOutcome(providerResult.outcome)
  const attemptNumber = (message.retry_count || 0) + 1
  let failureReason = providerResult.outcome === PROVIDER_OUTCOMES.REJECTED
    ? providerResult.detail?.reason || 'rejected'
    : null

  if (nextStatus === MESSAGE_STATUSES.RETRY_SCHEDULED && !isRetryableFailure(failureReason)) {
    nextStatus = MESSAGE_STATUSES.FAILED
  }

  const update = {
    status: nextStatus,
    provider_key: provider.key,
    updated_at: new Date(),
    failure_reason: failureReason,
    processing_lease_until: null,
  }

  if (providerResult.outcome === PROVIDER_OUTCOMES.ACTION_REQUIRED) {
    update.whatsapp_url = providerResult.detail?.whatsapp_url || null
    update.manual_send_required = true
  }

  if (nextStatus === MESSAGE_STATUSES.RETRY_SCHEDULED) {
    update.retry_count = attemptNumber
    update.scheduled_at = new Date(Date.now() + 15 * 60 * 1000)
  }

  await db.collection('messages').updateOne(
    { id: messageId, clinic_id: clinicId },
    { $set: update }
  )

  const updated = { ...message, ...update }
  await recordMessageAttempt(db, updated, providerResult, attemptNumber)

  if (nextStatus === MESSAGE_STATUSES.ACTION_REQUIRED) {
    await recordCommunicationEvent(db, profile, updated, 'message_action_required', {
      whatsapp_url_present: Boolean(update.whatsapp_url),
    })
  } else if (nextStatus === MESSAGE_STATUSES.FAILED) {
    await recordCommunicationEvent(db, profile, updated, 'message_failed', {
      reason: update.failure_reason,
    })
  }

  return { ok: true, message: cleanDoc(updated), provider_result: providerResult }
}

export async function listMessages(db, clinicId, opts = {}) {
  const { status, filter, limit = 50, skip = 0 } = opts
  const query = { clinic_id: clinicId }

  if (status) query.status = status
  if (filter === 'action_required') query.status = MESSAGE_STATUSES.ACTION_REQUIRED
  if (filter === 'due_now') {
    query.status = { $in: [MESSAGE_STATUSES.QUEUED, MESSAGE_STATUSES.SCHEDULED, MESSAGE_STATUSES.RETRY_SCHEDULED] }
    query.$or = [
      { scheduled_at: null },
      { scheduled_at: { $lte: new Date() } },
    ]
  }
  if (filter === 'sent') query.status = MESSAGE_STATUSES.SENT
  if (filter === 'failed') query.status = MESSAGE_STATUSES.FAILED

  const [messages, total] = await Promise.all([
    db.collection('messages').find(query).sort({ created_at: -1 }).skip(skip).limit(Math.min(limit, 200)).toArray(),
    db.collection('messages').countDocuments(query),
  ])

  return {
    ok: true,
    messages: messages.map(cleanDoc),
    total,
    pagination: { skip, limit },
  }
}

export async function recordMessageOpened(db, profile, messageId) {
  const clinicId = profile.clinic_id
  const message = await db.collection('messages').findOne({ id: messageId, clinic_id: clinicId })
  if (!message) return { ok: false, error: 'Message not found' }

  const now = new Date()
  await db.collection('messages').updateOne(
    { id: messageId, clinic_id: clinicId },
    {
      $set: {
        opened_at: message.opened_at || now,
        opened_by_user_id: profile.id,
        updated_at: now,
      },
    }
  )

  const updated = { ...message, opened_at: message.opened_at || now, opened_by_user_id: profile.id }
  await recordCommunicationEvent(db, profile, updated, 'message_opened')

  return { ok: true, message: cleanDoc(updated) }
}

export async function markMessageSent(db, profile, messageId) {
  const clinicId = profile.clinic_id
  if (!profile?.id || profile.id === 'system') {
    return { ok: false, error: 'Authorized staff user required' }
  }

  const message = await db.collection('messages').findOne({ id: messageId, clinic_id: clinicId })
  if (!message) return { ok: false, error: 'Message not found' }

  if (message.status !== MESSAGE_STATUSES.ACTION_REQUIRED) {
    return { ok: false, error: 'Only action_required messages can be marked as sent' }
  }

  const now = new Date()
  const result = await db.collection('messages').updateOne(
    { id: messageId, clinic_id: clinicId, status: MESSAGE_STATUSES.ACTION_REQUIRED },
    {
      $set: {
        status: MESSAGE_STATUSES.SENT,
        sent_by_user_id: profile.id,
        sent_at: now,
        updated_at: now,
      },
    }
  )

  if (!result.modifiedCount) {
    return { ok: false, error: 'Message status changed; cannot mark as sent' }
  }

  const updated = {
    ...message,
    status: MESSAGE_STATUSES.SENT,
    sent_by_user_id: profile.id,
    sent_at: now,
  }
  await recordCommunicationEvent(db, profile, updated, 'message_sent')

  return { ok: true, message: cleanDoc(updated) }
}

export async function cancelMessage(db, profile, messageId) {
  const clinicId = profile.clinic_id
  const message = await db.collection('messages').findOne({ id: messageId, clinic_id: clinicId })
  if (!message) return { ok: false, error: 'Message not found' }

  if (!CANCELABLE_STATUSES.includes(message.status)) {
    return { ok: false, error: `Cannot cancel message in status ${message.status}` }
  }

  await db.collection('messages').updateOne(
    { id: messageId, clinic_id: clinicId },
    { $set: { status: MESSAGE_STATUSES.CANCELLED, updated_at: new Date() } }
  )

  const updated = { ...message, status: MESSAGE_STATUSES.CANCELLED }
  await recordCommunicationEvent(db, profile, updated, 'message_cancelled')

  return { ok: true, message: cleanDoc(updated) }
}

export async function processDueMessages(db, clinicId = null) {
  const now = new Date()
  const query = {
    status: { $in: [MESSAGE_STATUSES.QUEUED, MESSAGE_STATUSES.SCHEDULED, MESSAGE_STATUSES.RETRY_SCHEDULED] },
    $or: [{ scheduled_at: null }, { scheduled_at: { $lte: now } }],
  }
  if (clinicId) query.clinic_id = clinicId

  const due = await db.collection('messages').find(query).sort({ scheduled_at: 1 }).limit(100).toArray()
  let processed = 0
  let skipped = 0

  for (const msg of due) {
    const profile = systemProfile(msg.clinic_id)
    try {
      const result = await processMessage(db, profile, msg.id)
      if (result.ok) processed++
      else skipped++
    } catch {
      skipped++
    }
  }

  return { ok: true, processed, skipped }
}

export async function cancelUnsentAppointmentMessages(db, profile, appointmentId) {
  const clinicId = profile.clinic_id
  const result = await db.collection('messages').updateMany(
    {
      clinic_id: clinicId,
      appointment_id: appointmentId,
      status: { $in: UNSENT_MESSAGE_STATUSES },
    },
    {
      $set: {
        status: MESSAGE_STATUSES.CANCELLED,
        failure_reason: 'cancelled',
        updated_at: new Date(),
      },
    }
  )
  return { cancelled: result.modifiedCount || 0 }
}

export { systemProfile }
