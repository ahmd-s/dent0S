export const EMPTY = '—'

export const fmtDate = d => {
  if (!d) return EMPTY
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return EMPTY
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const fmtDateTime = d => {
  if (!d) return EMPTY
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return EMPTY
  return dt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export const fmtMoney = n => {
  if (n == null || Number.isNaN(Number(n))) return EMPTY
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export const fmtAction = action => (action || '').replace(/_/g, ' ')

export const fmtRelative = d => {
  if (!d) return 'Never'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return 'Never'
  const diffMs = Date.now() - dt.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

export const initials = name => {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

export const PLATFORM_STATUS_OPTIONS = [
  { value: 'none', label: 'No override' },
  { value: 'active', label: 'Force active' },
  { value: 'force_trial', label: 'Force trial' },
  { value: 'comped', label: 'Comped' },
  { value: 'locked', label: 'Locked' },
  { value: 'force_active', label: 'Force active (alt)' },
]

export const LIFECYCLE_STATUS_LABELS = {
  trial: 'Trial',
  active: 'Active',
  grace: 'Grace period',
  paused: 'Paused',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
  comped: 'Comped',
  locked: 'Locked',
}

export const LIFECYCLE_STATUS_TONES = {
  trial: 'blue',
  active: 'green',
  grace: 'amber',
  paused: 'amber',
  blocked: 'red',
  cancelled: 'red',
  comped: 'violet',
  locked: 'red',
}

export const SUBSCRIPTION_TIMELINE_ACTIONS = new Set([
  'subscription_status_changed',
  'clinic_access_status_changed',
  'manual_payment_recorded',
  'trial_expired_auto_blocked',
  'trial_auto_enforcement_changed',
  'trial_date_changed',
  'lifecycle_status_changed',
  'emergency_lock',
  'emergency_unlock',
  'payment_recovered',
  'payment_failed_grace_started',
  'grace_expired_auto_blocked',
])

export const isBlocked = clinic => clinic?.subscription_status === 'blocked'
