/**
 * Appointment status lifecycle — Sprint 13 Dental Flow Engine.
 * Backward compatible with legacy: arrived → checked_in, in_progress → in_treatment, called → doctor_ready.
 */

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
  'waiting',
  'called',
  'doctor_ready',
  'in_treatment',
  'treatment_paused',
  'lab_pending',
  'billing',
  'completed',
  'archived',
  'cancelled',
  'no_show',
]

/** Legacy status aliases normalized to canonical values. */
const LEGACY_MAP = {
  arrived: 'checked_in',
  in_progress: 'in_treatment',
  called: 'doctor_ready',
}

/** Statuses that block scheduling slots (doctor/chair). */
export const BLOCKING_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
  'waiting',
  'called',
  'doctor_ready',
  'in_treatment',
  'treatment_paused',
  'lab_pending',
  'billing',
  // legacy
  'arrived',
  'in_progress',
]

export const QUEUE_STATUSES = [
  'checked_in', 'waiting', 'called', 'doctor_ready',
  'in_treatment', 'treatment_paused', 'lab_pending', 'billing',
  'arrived', 'in_progress',
]

/** Flow queue board columns (Sprint 13). */
export const FLOW_QUEUE_COLUMNS = [
  { id: 'waiting', label: 'Waiting', statuses: ['checked_in', 'waiting', 'arrived'] },
  { id: 'doctor_ready', label: 'Doctor Ready', statuses: ['called', 'doctor_ready'] },
  { id: 'in_treatment', label: 'In Treatment', statuses: ['in_treatment', 'in_progress', 'treatment_paused'] },
  { id: 'lab', label: 'Lab', statuses: ['lab_pending'] },
  { id: 'billing', label: 'Billing', statuses: ['billing'] },
  { id: 'completed', label: 'Completed', statuses: ['completed', 'archived'] },
]

export const STATUS_LABELS = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  waiting: 'Waiting',
  called: 'Doctor Ready',
  doctor_ready: 'Doctor Ready',
  in_treatment: 'In Treatment',
  treatment_paused: 'Treatment Paused',
  lab_pending: 'Lab Pending',
  billing: 'Billing',
  completed: 'Completed',
  archived: 'Archived',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  arrived: 'Checked In',
  in_progress: 'In Treatment',
}

const TONE = {
  muted: 'bg-muted/70 text-muted-foreground',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  success: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300',
  critical: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
}

export const STATUS_COLORS = {
  scheduled: TONE.muted,
  confirmed: TONE.muted,
  checked_in: TONE.info,
  waiting: TONE.warning,
  called: TONE.info,
  doctor_ready: TONE.info,
  in_treatment: TONE.warning,
  treatment_paused: TONE.warning,
  lab_pending: TONE.info,
  billing: TONE.info,
  completed: TONE.success,
  archived: TONE.muted,
  cancelled: TONE.critical,
  no_show: TONE.muted,
  arrived: TONE.info,
  in_progress: TONE.warning,
}

/** Allowed transitions keyed by normalized status. */
export const STATUS_TRANSITIONS = {
  scheduled: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'scheduled'],
  checked_in: ['waiting', 'cancelled', 'no_show'],
  waiting: ['doctor_ready', 'called', 'cancelled', 'no_show'],
  called: ['in_treatment', 'waiting', 'cancelled', 'doctor_ready'],
  doctor_ready: ['in_treatment', 'waiting', 'cancelled'],
  in_treatment: ['treatment_paused', 'lab_pending', 'billing', 'completed', 'waiting'],
  treatment_paused: ['in_treatment', 'lab_pending', 'billing', 'completed'],
  lab_pending: ['in_treatment', 'billing', 'completed'],
  billing: ['completed', 'in_treatment'],
  completed: ['archived'],
  archived: [],
  cancelled: [],
  no_show: [],
}

/** Map flow queue column id → target status when dragging. */
export const FLOW_COLUMN_STATUS = {
  waiting: 'waiting',
  doctor_ready: 'doctor_ready',
  in_treatment: 'in_treatment',
  lab: 'lab_pending',
  billing: 'billing',
  completed: 'completed',
}

export function normalizeStatus(status) {
  if (!status) return 'scheduled'
  const s = String(status).toLowerCase()
  return LEGACY_MAP[s] || s
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS[normalizeStatus(status)] || status?.replace(/_/g, ' ')
}

export function isBlockingStatus(status) {
  return BLOCKING_STATUSES.includes(status) || BLOCKING_STATUSES.includes(normalizeStatus(status))
}

export function canTransition(from, to) {
  const f = normalizeStatus(from)
  const t = normalizeStatus(to)
  if (f === t) return true
  const allowed = STATUS_TRANSITIONS[f] || []
  return allowed.includes(t)
}

export function isInQueue(status) {
  const s = normalizeStatus(status)
  return ['checked_in', 'waiting', 'called', 'doctor_ready', 'in_treatment', 'treatment_paused', 'lab_pending', 'billing'].includes(s)
}

export function queueSortOrder(status) {
  const order = {
    checked_in: 0, waiting: 1, called: 2, doctor_ready: 2,
    in_treatment: 3, treatment_paused: 3, lab_pending: 4, billing: 5,
  }
  return order[normalizeStatus(status)] ?? 99
}

export function matchFlowColumn(status) {
  const s = normalizeStatus(status)
  for (const col of FLOW_QUEUE_COLUMNS) {
    if (col.statuses.some(st => normalizeStatus(st) === s)) return col.id
  }
  return null
}

/** Flow stage order for timeline visualization. */
export const FLOW_TIMELINE_STAGES = [
  'APPOINTMENT_CREATED',
  'PATIENT_CHECKED_IN',
  'CHAIR_ASSIGNED',
  'DOCTOR_READY',
  'TREATMENT_STARTED',
  'TREATMENT_PAUSED',
  'TREATMENT_RESUMED',
  'LAB_SENT',
  'LAB_RECEIVED',
  'BILLING_STARTED',
  'PAYMENT_RECEIVED',
  'VISIT_COMPLETED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_RESCHEDULED',
  'NO_SHOW',
]
