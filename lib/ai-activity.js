/**
 * AI activity logging — Sprint 18.
 */

import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

const TYPE_EVENT_MAP = {
  clinical_summary: ACTIVITY_EVENTS.AI_SUMMARY_CREATED,
  patient_history: ACTIVITY_EVENTS.AI_SUMMARY_CREATED,
  voice_summary: ACTIVITY_EVENTS.AI_VOICE_PROCESSED,
  prescription_draft: ACTIVITY_EVENTS.AI_PRESCRIPTION_DRAFTED,
  treatment_suggestion: ACTIVITY_EVENTS.AI_TREATMENT_SUGGESTED,
  recall_suggestion: ACTIVITY_EVENTS.AI_RECALL_SUGGESTED,
  business_insight: ACTIVITY_EVENTS.AI_BUSINESS_INSIGHT,
  doctor_brief: ACTIVITY_EVENTS.AI_DOCTOR_BRIEF,
  patient_explanation: ACTIVITY_EVENTS.AI_PATIENT_EXPLANATION,
  xray_analysis: ACTIVITY_EVENTS.AI_XRAY_ANALYZED,
  automation: ACTIVITY_EVENTS.AI_AUTOMATION_PREPARED,
}

export async function logAIEvent(db, profile, request, eventOverride = null) {
  const event = eventOverride || TYPE_EVENT_MAP[request?.type] || ACTIVITY_EVENTS.AI_REQUEST
  await logActivity(db, profile, event, {
    patientId: request?.patient_id || null,
    visitId: request?.visit_id || null,
    metadata: {
      ai_request_id: request?.id,
      type: request?.type,
      provider: request?.provider,
      status: request?.status,
      tokens_estimated: request?.tokens_estimated || null,
    },
  })
}
