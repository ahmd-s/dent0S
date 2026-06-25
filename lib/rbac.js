// Role-Based Access Control (RBAC) system for DentOS

export const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist'
}

// Permission matrix defining what each role can do
// Resources: patients, visits, appointments, billing, staff, settings, inventory, lab_cases, consent_templates
// Actions: read, create, update, delete, full_access
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
    consent_templates: 'full_access'
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
    consent_templates: 'full_access'
  },
  [ROLES.RECEPTIONIST]: {
    patients: 'basic_info_only',
    visits: 'no_access',
    appointments: 'full_access',
    billing: 'full_access',
    staff: 'no_access',
    settings: 'no_access',
    inventory: 'no_access',
    lab_cases: 'no_access',
    consent_templates: 'no_access'
  }
}

// Route restrictions for middleware
// Maps path patterns to roles that are denied access
const ROUTE_RESTRICTIONS = {
  [ROLES.RECEPTIONIST]: [
    '/settings',
    '/visits',
    '/inventory',
    '/lab-cases',
    '/vendors'
  ],
  [ROLES.DOCTOR]: [
    '/settings'
  ]
}

/**
 * Check if a role can access a specific route
 * @param {string} role - The user's role
 * @param {string} pathname - The route pathname
 * @returns {boolean} - True if access is allowed, false otherwise
 */
export function canAccessRoute(role, pathname) {
  if (!role) return false
  
  // Get restricted routes for this role
  const restrictedPaths = ROUTE_RESTRICTIONS[role]
  if (!restrictedPaths) return true
  
  // Check if the pathname matches any restricted path
  for (const restricted of restrictedPaths) {
    if (pathname === restricted || pathname.startsWith(restricted + '/')) {
      return false
    }
  }
  
  return true
}

/**
 * Check if a role has permission for a specific resource and action
 * @param {string} role - The user's role
 * @param {string} resource - The resource (e.g., 'patients', 'visits', 'billing')
 * @param {string} action - The action (e.g., 'read', 'create', 'update', 'delete')
 * @returns {boolean} - True if permission is granted， false otherwise
 */
export function hasPermission(role, resource, action) {
  if (!role) return false
  
  const rolePermissions = PERMISSION_MATRIX[role]
  if (!rolePermissions) return false
  
  const permissionLevel = rolePermissions[resource]
  if (!permissionLevel) return false
  
  // Full access grants all actions
  if (permissionLevel === 'full_access') return true
  
  // Read only grants only read actions
  if (permissionLevel === 'read_only') return action === 'read'
  
  // Basic info only for patients - limited read access
  if (permissionLevel === 'basic_info_only' && resource === 'patients') {
    return action === 'read'
  }
  
  // No access grants nothing
  if (permissionLevel === 'no_access') return false
  
  return false
}

/**
 * Check if a role can manage billing (create, update, delete invoices)
 * @param {string} role - The user's role
 * @returns {boolean} - True if billing management is allowed
 */
export function canManageBilling(role) {
  if (!role) return false
  return role === ROLES.ADMIN || role === ROLES.RECEPTIONIST
}

/**
 * Check if a role can access clinical data (visits, notes, documents, X-rays)
 * @param {string} role - The user's role
 * @returns {boolean} - True if clinical access is allowed
 */
export function canAccessClinical(role) {
  if (!role) return false
  return role === ROLES.ADMIN || role === ROLES.DOCTOR
}

/**
 * Check if a role can manage inventory
 * @param {string} role - The user's role
 * @returns {boolean} - True if inventory management is allowed
 */
export function canManageInventory(role) {
  if (!role) return false
  return role === ROLES.ADMIN || role === ROLES.DOCTOR
}

/**
 * Check if a role can manage staff (add, edit, deactivate team members)
 * @param {string} role - The user's role
 * @returns {boolean} - True if staff management is allowed
 */
export function canManageStaff(role) {
  if (!role) return false
  return role === ROLES.ADMIN
}

/**
 * Check if a role can access settings
 * @param {string} role - The user's role
 * @returns {boolean} - True if settings access is allowed
 */
export function canAccessSettings(role) {
  if (!role) return false
  return role === ROLES.ADMIN
}

/**
 * Get allowed fields for patient data based on role
 * @param {string} role - The user's role
 * @returns {string[]} - Array of field names that can be accessed
 */
export function getPatientAllowedFields(role) {
  if (role === ROLES.RECEPTIONIST) {
    // Receptionist can only see basic info
    return ['id', 'name', 'phone', 'age', 'patient_code', 'created_at']
  }
  // Admin and doctor can see all fields
  return null // null means no restriction
}

/**
 * Check if a role can view patient clinical data
 * @param {string} role - The user's role
 * @returns {boolean} - True if clinical data access is allowed
 */
export function canViewPatientClinicalData(role) {
  return canAccessClinical(role)
}
