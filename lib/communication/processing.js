import {
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
  PROCESSING_LEASE_MS,
} from './constants.js'
import { buildWhatsAppUrl } from './phone.js'
import { assertWhatsAppOptIn } from './consent.js'
import { unwrapFindOneAndUpdate } from '../mongo-result.js'

function cleanDoc(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}

export async function claimMessageForProcessing(db, messageId, clinicId) {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + PROCESSING_LEASE_MS)

  const result = await db.collection('messages').findOneAndUpdate(
    {
      id: messageId,
      clinic_id: clinicId,
      status: { $in: [MESSAGE_STATUSES.QUEUED, MESSAGE_STATUSES.SCHEDULED, MESSAGE_STATUSES.RETRY_SCHEDULED] },
      $and: [
        { $or: [{ scheduled_at: null }, { scheduled_at: { $lte: now } }] },
        {
          $or: [
            { processing_lease_until: null },
            { processing_lease_until: { $exists: false } },
            { processing_lease_until: { $lt: now } },
          ],
        },
      ],
    },
    {
      $set: {
        status: MESSAGE_STATUSES.PROCESSING,
        processing_lease_until: leaseUntil,
        processing_claimed_at: now,
        updated_at: now,
      },
    },
    { returnDocument: 'after' }
  )

  return unwrapFindOneAndUpdate(result)
}

export function resolveWhatsAppUrl(message) {
  if (!message || message.status !== MESSAGE_STATUSES.ACTION_REQUIRED) return null
  return message.whatsapp_url
    || (message.recipient_e164 ? buildWhatsAppUrl(message.recipient_e164, message.body) : null)
}

export async function getWhatsAppUrl(db, profile, messageId) {
  const clinicId = profile.clinic_id
  const message = await db.collection('messages').findOne({ id: messageId, clinic_id: clinicId })
  if (!message) return { ok: false, error: 'Message not found' }

  if (message.status !== MESSAGE_STATUSES.ACTION_REQUIRED) {
    return { ok: false, error: 'WhatsApp URL is only available for action_required messages' }
  }

  const url = resolveWhatsAppUrl(message)
  if (!url) return { ok: false, error: 'Unable to build WhatsApp URL' }

  return {
    ok: true,
    whatsapp_url: url,
    manual_send_required: true,
    message: cleanDoc({ ...message, whatsapp_url: url }),
  }
}

export async function assertPatientConsentForProcessing(db, clinicId, message) {
  if (!message.patient_id || message.type === MESSAGE_TYPES.DOCTOR_DAILY_SCHEDULE) {
    return { ok: true }
  }
  return assertWhatsAppOptIn(db, clinicId, message.patient_id)
}

export { cleanDoc }
