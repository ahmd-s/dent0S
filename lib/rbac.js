// Role-Based Access Control (RBAC) for DentOS — union across profiles.roles[]

import { getProfileRoles, hasRole } from '@/lib/profile-roles'

export const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
}

// Permission matrix per role (explicit — no role implies another)
const PERMISSION_MATRIX = {
  [ROLES.ADMIN]: {
    patients: 'full_access',
    visits: 'full_access',
    appointments: 'full_access',
    billing: 'full_access',
    staff: 'full_access',
    settings: 'full_access',
    inventory: 'full_access',
    lab_cases: 'full_access',
    consent_templates: 'full_access',
  },
  [ROLES.DOCTOR]: {
    patients: 'full_access',
    visits: 'full_access',
    appointments: 'full_access',
    billing: 'read_only',
    staff: 'no_access',
    settings: 'no_access',
    inventory: 'full_access',
    lab_cases: 'full_access',
    consent_templates: 'full_access',
  },
  [ROLES.RECEPTIONIST]: {
    patients: 'full_access',
    visits: 'clinical_read',
    appointments: 'full_access',
    billing: 'full_access',
    staff: 'no_access',
    settings: 'no_access',
    inventory: 'full_access',
    lab_cases: 'full_access',
    consent_templates: 'no_access',
  },
}

// Routes denied for a single role (union: allowed if any role permits)
const ROUTE_RESTRICTIONS = {
  [ROLES.RECEPTIONIST]: ['/settings'],
  [ROLES.DOCTOR]: ['/settings'],
}

function normalizeInput(roles) {
  return getProfileRoles(roles)
}

function permissionLevelForRole(role, resource) {
  return PERMISSION_MATRIX[role]?.[resource] ?? 'no_access'
}

function actionAllowedByLevel(level, resource, action) {
  if (level === 'no_access') return false
  if (level === 'full_access') return true
  if (level === 'read_only') return action === 'read'
  if (level === 'clinical_read' && resource === 'visits') {
    return action === 'read'
  }
  if (level === 'basic_info_only' && resource === 'patients') {
    return action === 'read'
  }
  return false
}

function canAccessRouteForRole(role, pathname) {
  const restrictedPaths = ROUTE_RESTRICTIONS[role]
  if (!restrictedPaths) return true
  for (const restricted of restrictedPaths) {
    if (pathname === restricted || pathname.startsWith(restricted + '/')) {
      return false
    }
  }
  return true
}

/**
 * Union: route allowed if any role permits it.
 * @param {string|string[]|object} roles - roles array, legacy role string, or profile
 * @param {string} pathname
 */
export function canAccessRoute(roles, pathname) {
  const list = normalizeInput(roles)
  if (list.length === 0) return false
  return list.some(role => canAccessRouteForRole(role, pathname))
}

/**
 * Union: permission granted if any role grants the action.
 * @param {string|string[]|object} roles
 * @param {string} resource
 * @param {string} action - read | create | update | delete
 */
export function hasPermission(roles, resource, action) {
  const list = normalizeInput(roles)
  if (list.length === 0) return false
  return list.some(role => {
    const level = permissionLevelForRole(role, resource)
    return actionAllowedByLevel(level, resource, action)
  })
}

export function canManageBilling(roles) {
  const list = normalizeInput(roles)
  return list.some(r => r === ROLES.ADMIN || r === ROLES.RECEPTIONIST)
}

/** Edit clinical notes, prescriptions, etc. */
export function canAccessClinical(roles) {
  const list = normalizeInput(roles)
  return list.some(r => r === ROLES.ADMIN || r === ROLES.DOCTOR)
}

/** View clinical data (includes receptionist read-only). */
export function canViewClinical(roles) {
  const list = normalizeInput(roles)
  if (list.length === 0) return false
  return list.some(role => {
    const level = permissionLevelForRole(role, 'visits')
    return level === 'full_access' || level === 'clinical_read'
  })
}

/** Alias — edit clinical (doctor/admin only, scope enforced separately). */
export function canEditClinical(roles) {
  return canAccessClinical(roles)
}

export function canManageInventory(roles) {
  const list = normalizeInput(roles)
  return list.some(r =>
    r === ROLES.ADMIN || r === ROLES.DOCTOR || r === ROLES.RECEPTIONIST
  )
}

export function canManageStaff(roles) {
  return hasRole(normalizeInput(roles), ROLES.ADMIN)
}

export function canAccessSettings(roles) {
  return hasRole(normalizeInput(roles), ROLES.ADMIN)
}

export function canDeleteInventory(roles) {
  return hasRole(normalizeInput(roles), ROLES.ADMIN)
}

/**
 * Receptionist-only (no doctor/admin): strip clinical patient fields on read.
 * Union with doctor/admin → no field restriction.
 */
export function shouldFilterPatientClinicalFields(roles) {
  const list = normalizeInput(roles)
  return (
    hasRole(list, ROLES.RECEPTIONIST) &&
    !hasRole(list, ROLES.DOCTOR) &&
    !hasRole(list, ROLES.ADMIN)
  )
}

/**
 * Allowed patient fields for receptionist-only users.
 * @returns {string[]|null} null = no restriction
 */
export function getPatientAllowedFields(roles) {
  if (!shouldFilterPatientClinicalFields(roles)) return null
  return [
    'id',
    'name',
    'phone',
    'age',
    'gender',
    'patient_code',
    'created_at',
    'last_visit_date',
    'next_followup_date',
    'total_visits',
    'address',
    'referral_source',
    'is_archived',
    'clinic_id',
  ]
}

export function filterPatientFields(patient, roles) {
  const allowed = getPatientAllowedFields(roles)
  if (!allowed || !patient) return patient
  const out = {}
  for (const key of allowed) {
    if (key in patient) out[key] = patient[key]
  }
  return out
}

/** @deprecated use canViewClinical */
export function canViewPatientClinicalData(roles) {
  return canViewClinical(roles)
}
