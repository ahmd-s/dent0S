/**
 * lib/authorization-engine.js
 *
 * Single source of truth for every authorization decision in DentOS.
 *
 * Layers (evaluated in order; first denial wins):
 *   1. Clinic access status (blocked / paused)
 *   2. Subscription feature flags (optional — off by default for API compat)
 *   3. RBAC role matrix
 *   4. Workspace permissions (optional — off by default for API compat)
 *
 * Platform admin uses authorizePlatformAdmin() — separate path.
 */

import { getProfileRoles, hasRole } from '@/lib/profile-roles'
import { DEFAULT_FEATURES } from '@/lib/default-features'
import { getEffectiveWorkspaceRole } from '@/lib/workspace-client'
import { getRoleWorkspace } from '@/lib/workspace-engine'

export const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
}

export const AUTH_ACTIONS = ['read', 'create', 'update', 'delete', 'access']

export const AUTH_CODES = {
  ALLOWED: 'ALLOWED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  CLINIC_BLOCKED: 'CLINIC_BLOCKED',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  WORKSPACE_DENIED: 'WORKSPACE_DENIED',
  ROUTE_DENIED: 'ROUTE_DENIED',
  NOT_FOUND: 'NOT_FOUND',
}

export const CLINIC_ACCESS_PAUSED_MESSAGE =
  "This clinic's access is currently paused. Contact Connec8 for assistance."

export const PERMISSION_MATRIX = {
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

export const ROUTE_RESTRICTIONS = {
  [ROLES.RECEPTIONIST]: ['/settings', '/subscription'],
  [ROLES.DOCTOR]: ['/settings', '/subscription'],
}

export const RESOURCE_FEATURE_MAP = {
  appointments: 'appointments',
  billing: 'billing',
  inventory: 'inventory',
  lab_cases: 'labs',
  patients: 'appointments',
  visits: 'appointments',
  consent_templates: 'appointments',
  staff: 'appointments',
  settings: 'appointments',
}

export const WORKSPACE_PERMISSION_MAP = {
  'patients:create': 'create_patient',
  'patients:update': 'edit_patient',
  'patients:delete': 'delete_patient',
  'appointments:create': 'create_appointment',
  'appointments:update': 'edit_appointment',
  'appointments:delete': 'cancel_appointment',
  'billing:create': 'create_invoice',
  'billing:update': 'edit_invoice',
  'billing:delete': 'delete_invoice',
  'inventory:update': 'manage_inventory',
  'inventory:create': 'manage_inventory',
  'staff:update': 'manage_staff',
  'settings:update': 'manage_settings',
  'settings:read': 'manage_settings',
}

const RECEPTIONIST_PATIENT_FIELDS = [
  'id', 'name', 'phone', 'age', 'gender', 'patient_code', 'created_at',
  'last_visit_date', 'next_followup_date', 'total_visits', 'address',
  'referral_source', 'is_archived', 'clinic_id',
]

function normalizeRoles(input) {
  return getProfileRoles(input)
}

function permissionLevelForRole(role, resource) {
  return PERMISSION_MATRIX[role]?.[resource] ?? 'no_access'
}

function actionAllowedByLevel(level, resource, action) {
  if (level === 'no_access') return false
  if (level === 'full_access') return true
  if (level === 'read_only') return action === 'read'
  if (level === 'clinical_read' && resource === 'visits') return action === 'read'
  if (level === 'basic_info_only' && resource === 'patients') return action === 'read'
  return false
}

function deny(code, reason, status = 403) {
  return { allowed: false, code, reason, status }
}

function allow(extra = {}) {
  return { allowed: true, code: AUTH_CODES.ALLOWED, ...extra }
}

function checkRbac(roles, resource, action) {
  const list = normalizeRoles(roles)
  if (list.length === 0) return deny(AUTH_CODES.FORBIDDEN, 'Forbidden', 403)
  const allowed = list.some(role =>
    actionAllowedByLevel(permissionLevelForRole(role, resource), resource, action)
  )
  return allowed ? allow({ roles: list }) : deny(AUTH_CODES.FORBIDDEN, 'Forbidden', 403)
}

function checkClinicStatus(clinic, { skipClinicCheck = false } = {}) {
  if (skipClinicCheck || !clinic) return allow()
  if (clinic.subscription_status === 'blocked') {
    return deny(AUTH_CODES.CLINIC_BLOCKED, CLINIC_ACCESS_PAUSED_MESSAGE, 403)
  }
  return allow()
}

function checkFeatureFlag(clinic, resource) {
  const featureKey = RESOURCE_FEATURE_MAP[resource]
  if (!featureKey) return allow()
  const features = clinic?.features || DEFAULT_FEATURES
  if (features[featureKey] === false) {
    return deny(AUTH_CODES.FEATURE_DISABLED, 'Feature not enabled for this clinic', 403)
  }
  return allow()
}

function checkWorkspacePermission(workspace, resource, action) {
  if (!workspace?.permissions) return allow()
  const key = WORKSPACE_PERMISSION_MAP[`${resource}:${action}`]
  if (!key) return allow()
  if (workspace.permissions[key] !== true) {
    return deny(AUTH_CODES.WORKSPACE_DENIED, 'Action disabled by workspace configuration', 403)
  }
  return allow()
}

export function authorizeSync({
  profile = null,
  roles = null,
  clinic = null,
  resource,
  action = 'read',
  pathname = null,
  workspace = null,
  skipClinicCheck = false,
  checkFeatures = false,
  checkWorkspace = false,
} = {}) {
  const roleList = normalizeRoles(roles ?? profile)

  if (pathname != null) {
    return authorizeRouteSync({ roles: roleList, pathname, clinic, skipClinicCheck })
  }

  if (!resource) return deny(AUTH_CODES.FORBIDDEN, 'Resource is required', 400)

  const clinicResult = checkClinicStatus(clinic, { skipClinicCheck })
  if (!clinicResult.allowed) return clinicResult

  if (checkFeatures) {
    const featureResult = checkFeatureFlag(clinic, resource)
    if (!featureResult.allowed) return featureResult
  }

  const rbacResult = checkRbac(roleList, resource, action)
  if (!rbacResult.allowed) return rbacResult

  if (checkWorkspace && workspace) {
    const wsResult = checkWorkspacePermission(workspace, resource, action)
    if (!wsResult.allowed) return wsResult
  }

  return allow({ roles: roleList })
}

export async function authorize({
  db = null,
  profile = null,
  roles = null,
  clinic = null,
  resource,
  action = 'read',
  pathname = null,
  workspace = null,
  skipClinicCheck = false,
  checkFeatures = false,
  checkWorkspace = false,
} = {}) {
  let resolvedWorkspace = workspace

  if (checkWorkspace && !resolvedWorkspace && db && clinic?.id && profile) {
    const role = getEffectiveWorkspaceRole(profile)
    const wsResult = await getRoleWorkspace(db, clinic.id, role)
    if (wsResult.ok) resolvedWorkspace = wsResult.config
  }

  return authorizeSync({
    profile,
    roles,
    clinic,
    resource,
    action,
    pathname,
    workspace: resolvedWorkspace,
    skipClinicCheck,
    checkFeatures,
    checkWorkspace,
  })
}

export function authorizeRouteSync({ roles, pathname, clinic = null, skipClinicCheck = false }) {
  const clinicResult = checkClinicStatus(clinic, { skipClinicCheck })
  if (!clinicResult.allowed) return clinicResult

  const list = normalizeRoles(roles)
  if (list.length === 0) return deny(AUTH_CODES.ROUTE_DENIED, 'Unauthorized', 403)

  const allowed = list.some(role => {
    const restricted = ROUTE_RESTRICTIONS[role]
    if (!restricted) return true
    return !restricted.some(path => pathname === path || pathname.startsWith(path + '/'))
  })

  return allowed ? allow({ roles: list }) : deny(AUTH_CODES.ROUTE_DENIED, 'Unauthorized', 403)
}

export function authorizePlatformAdmin(profile) {
  if (!profile) return deny(AUTH_CODES.NOT_FOUND, 'Not found', 404)
  if (profile.is_platform_admin === true) return allow()
  if (profile.clinic_id == null) return allow()
  return deny(AUTH_CODES.NOT_FOUND, 'Not found', 404)
}

export function isClinicAccessBlocked(clinic) {
  return clinic?.subscription_status === 'blocked'
}

export function canAccessRoute(roles, pathname) {
  return authorizeRouteSync({ roles, pathname, skipClinicCheck: true }).allowed
}

export function hasPermission(roles, resource, action) {
  return authorizeSync({ roles, resource, action, skipClinicCheck: true }).allowed
}

export function canManageBilling(roles) {
  const list = normalizeRoles(roles)
  return list.some(r => r === ROLES.ADMIN || r === ROLES.RECEPTIONIST)
}

export function canEditInvoiceDate(roles) {
  const list = normalizeRoles(roles)
  if (list.some(r => r === ROLES.ADMIN)) return true
  if (list.some(r => r === ROLES.DOCTOR) && hasPermission(roles, 'billing', 'update')) return true
  return false
}

export function canAccessClinical(roles) {
  const list = normalizeRoles(roles)
  return list.some(r => r === ROLES.ADMIN || r === ROLES.DOCTOR)
}

export function canViewClinical(roles) {
  const list = normalizeRoles(roles)
  if (list.length === 0) return false
  return list.some(role => {
    const level = permissionLevelForRole(role, 'visits')
    return level === 'full_access' || level === 'clinical_read'
  })
}

export function canEditClinical(roles) {
  return canAccessClinical(roles)
}

export function canManageInventory(roles) {
  const list = normalizeRoles(roles)
  return list.some(r => r === ROLES.ADMIN || r === ROLES.DOCTOR || r === ROLES.RECEPTIONIST)
}

export function canManageStaff(roles) {
  return hasRole(normalizeRoles(roles), ROLES.ADMIN)
}

export function canAccessSettings(roles) {
  return hasRole(normalizeRoles(roles), ROLES.ADMIN)
}

export function canDeleteInventory(roles) {
  return hasRole(normalizeRoles(roles), ROLES.ADMIN)
}

export function shouldFilterPatientClinicalFields(roles) {
  const list = normalizeRoles(roles)
  return hasRole(list, ROLES.RECEPTIONIST) && !hasRole(list, ROLES.DOCTOR) && !hasRole(list, ROLES.ADMIN)
}

export function getPatientAllowedFields(roles) {
  if (!shouldFilterPatientClinicalFields(roles)) return null
  return RECEPTIONIST_PATIENT_FIELDS
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

export function canViewPatientClinicalData(roles) {
  return canViewClinical(roles)
}
