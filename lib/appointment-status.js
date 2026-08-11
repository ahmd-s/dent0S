/**
 * Appointment status lifecycle — Sprint 11.
 * Backward compatible with legacy: arrived → checked_in, in_progress → in_treatment.
 */

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
  'waiting',
  'called',
  'in_treatment',
  'completed',
  'cancelled',
  'no_show',
]

/** Legacy status aliases normalized to canonical values. */
const LEGACY_MAP = {
  arrived: 'checked_in',
  in_progress: 'in_treatment',
}

/** Statuses that block scheduling slots (doctor/chair). */
export const BLOCKING_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
  'waiting',
  'called',
  'in_treatment',
  // legacy
  'arrived',
  'in_progress',
]

export const QUEUE_STATUSES = ['checked_in', 'waiting', 'called', 'in_treatment', 'arrived', 'in_progress']

export const STATUS_LABELS = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  waiting: 'Waiting',
  called: 'Called',
  in_treatment: 'In Treatment',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  arrived: 'Checked In',
  in_progress: 'In Treatment',
}

export const STATUS_COLORS = {
  scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  confirmed: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300',
  checked_in: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  waiting: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  called: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300',
  in_treatment: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
  completed: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300',
  cancelled: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  no_show: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  arrived: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  in_progress: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
}

/** Allowed transitions keyed by normalized status. */
export const STATUS_TRANSITIONS = {
  scheduled: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'scheduled'],
  checked_in: ['waiting', 'cancelled', 'no_show'],
  waiting: ['called', 'cancelled', 'no_show'],
  called: ['in_treatment', 'waiting', 'cancelled'],
  in_treatment: ['completed', 'waiting'],
  completed: [],
  cancelled: [],
  no_show: [],
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
  return ['checked_in', 'waiting', 'called', 'in_treatment'].includes(s)
}

export function queueSortOrder(status) {
  const order = { checked_in: 0, waiting: 1, called: 2, in_treatment: 3 }
  return order[normalizeStatus(status)] ?? 99
}
