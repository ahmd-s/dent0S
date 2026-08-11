/**
 * Lab activity logging — Sprint 14.
 */

import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import { normalizeLabStatus } from '@/lib/lab-case-helpers'

const STATUS_EVENT_MAP = {
  pending: ACTIVITY_EVENTS.LAB_CREATED,
  impression_ready: ACTIVITY_EVENTS.IMPRESSION_UPLOADED,
  sent: ACTIVITY_EVENTS.LAB_SENT,
  lab_received: ACTIVITY_EVENTS.LAB_RECEIVED,
  in_production: ACTIVITY_EVENTS.LAB_MANUFACTURING_STARTED,
  in_progress: ACTIVITY_EVENTS.LAB_MANUFACTURING_STARTED,
  quality_check: ACTIVITY_EVENTS.LAB_QC_STARTED,
  ready: ACTIVITY_EVENTS.LAB_DISPATCHED,
  delivered: ACTIVITY_EVENTS.LAB_DELIVERED,
  received: ACTIVITY_EVENTS.LAB_DELIVERED,
  installed: ACTIVITY_EVENTS.LAB_INSTALLED,
  completed: ACTIVITY_EVENTS.LAB_COMPLETED,
  cancelled: ACTIVITY_EVENTS.LAB_STATUS_UPDATED,
}

export async function logLabStatusChange(db, profile, labCase, newStatus, metadata = {}) {
  const s = normalizeLabStatus(newStatus)
  const event = STATUS_EVENT_MAP[s] || ACTIVITY_EVENTS.LAB_STATUS_UPDATED
  await logActivity(db, profile, event, {
    patientId: labCase.patient_id,
    labCaseId: labCase.id,
    metadata: {
      case_number: labCase.case_number,
      from_status: labCase.status,
      to_status: s,
      ...metadata,
    },
  })
}

export async function logLabFieldChange(db, profile, labCase, event, metadata = {}) {
  await logActivity(db, profile, event, {
    patientId: labCase.patient_id,
    labCaseId: labCase.id,
    metadata: { case_number: labCase.case_number, ...metadata },
  })
}
