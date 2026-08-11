/**
 * Chair status lifecycle — Sprint 13 Dental Flow Engine.
 */

export const CHAIR_STATUSES = [
  'available',
  'reserved',
  'occupied',
  'cleaning',
  'out_of_service',
]

export const CHAIR_STATUS_LABELS = {
  available: 'Available',
  reserved: 'Reserved',
  occupied: 'Occupied',
  cleaning: 'Cleaning',
  out_of_service: 'Out Of Service',
}

export const CHAIR_STATUS_COLORS = {
  available: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300',
  reserved: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300',
  occupied: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
  cleaning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  out_of_service: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

/** Statuses that block chair assignment to new patients. */
export const OCCUPIED_CHAIR_STATUSES = ['occupied', 'cleaning', 'out_of_service']

export function normalizeChairStatus(status) {
  if (!status) return 'available'
  return String(status).toLowerCase()
}

export function isChairAssignable(status) {
  return !OCCUPIED_CHAIR_STATUSES.includes(normalizeChairStatus(status))
}

export function chairStatusLabel(status) {
  return CHAIR_STATUS_LABELS[normalizeChairStatus(status)] || status
}
