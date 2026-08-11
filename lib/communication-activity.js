/**
 * Communication activity logging — Sprint 17.
 */

import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

const TYPE_EVENT_MAP = {
  appointment_reminder: ACTIVITY_EVENTS.MESSAGE_APPOINTMENT_REMINDER,
  followup_reminder: ACTIVITY_EVENTS.MESSAGE_FOLLOWUP_REMINDER,
  invoice_reminder: ACTIVITY_EVENTS.MESSAGE_INVOICE_REMINDER,
  payment_reminder: ACTIVITY_EVENTS.MESSAGE_PAYMENT_REMINDER,
  lab_update: ACTIVITY_EVENTS.MESSAGE_LAB_UPDATE,
  treatment_reminder: ACTIVITY_EVENTS.MESSAGE_TREATMENT_REMINDER,
  review_request: ACTIVITY_EVENTS.MESSAGE_REVIEW_REQUEST,
  birthday_wish: ACTIVITY_EVENTS.MESSAGE_BIRTHDAY,
  anniversary_wish: ACTIVITY_EVENTS.MESSAGE_ANNIVERSARY,
  campaign: ACTIVITY_EVENTS.MESSAGE_CAMPAIGN,
  manual: ACTIVITY_EVENTS.MESSAGE_MANUAL,
}

export async function logCommunicationEvent(db, profile, message, eventOverride = null) {
  const event = eventOverride
    || TYPE_EVENT_MAP[message?.type]
    || ACTIVITY_EVENTS.MESSAGE_SENT

  await logActivity(db, profile, event, {
    patientId: message?.patient_id || null,
    appointmentId: message?.appointment_id || null,
    visitId: message?.visit_id || null,
    metadata: {
      message_id: message?.id,
      type: message?.type,
      channel: message?.channel,
      status: message?.status,
      campaign_id: message?.campaign_id || null,
      subject: message?.subject || null,
    },
  })
}

export async function logCommunicationStatusChange(db, profile, message, newStatus) {
  const event = newStatus === 'failed'
    ? ACTIVITY_EVENTS.MESSAGE_FAILED
    : newStatus === 'delivered'
      ? ACTIVITY_EVENTS.MESSAGE_DELIVERED
      : newStatus === 'cancelled'
        ? ACTIVITY_EVENTS.MESSAGE_CANCELLED
        : ACTIVITY_EVENTS.MESSAGE_SENT

  await logCommunicationEvent(db, profile, { ...message, status: newStatus }, event)
}

export async function logCampaignEvent(db, profile, campaign, event) {
  await logActivity(db, profile, event, {
    metadata: {
      campaign_id: campaign?.id,
      name: campaign?.name,
      audience: campaign?.audience,
      status: campaign?.status,
    },
  })
}

export async function logReviewEvent(db, profile, review, event) {
  await logActivity(db, profile, event, {
    patientId: review?.patient_id || null,
    visitId: review?.visit_id || null,
    metadata: {
      review_id: review?.id,
      status: review?.status,
      rating: review?.rating || null,
    },
  })
}
