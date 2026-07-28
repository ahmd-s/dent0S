// Profile role helpers — single source for roles[] migration and reads

export const VALID_ROLES = ['admin', 'doctor', 'receptionist']

/**
 * Normalize roles from a profile or raw input (string | string[]).
 * Falls back to legacy profile.role when roles[] is absent.
 */
export function getProfileRoles(profileOrRoles) {
  if (!profileOrRoles) return []

  if (Array.isArray(profileOrRoles)) {
    return profileOrRoles.filter(r => VALID_ROLES.includes(r))
  }

  if (typeof profileOrRoles === 'string') {
    return VALID_ROLES.includes(profileOrRoles) ? [profileOrRoles] : []
  }

  const profile = profileOrRoles
  if (Array.isArray(profile.roles) && profile.roles.length > 0) {
    return profile.roles.filter(r => VALID_ROLES.includes(r))
  }
  if (profile.role && VALID_ROLES.includes(profile.role)) {
    return [profile.role]
  }
  return []
}

export function hasRole(roles, role) {
  return getProfileRoles(roles).includes(role)
}

export function roleBadgeLabel(roles) {
  const list = getProfileRoles(roles)
  if (list.length === 0) return 'Staff'
  const labels = { admin: 'Admin', doctor: 'Doctor', receptionist: 'Receptionist' }
  return list.map(r => labels[r] || r).join(' · ')
}

/**
 * Validate roles array for writes. Requires ≥1 valid role; no mutual exclusivity.
 */
export function validateRolesArray(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return { ok: false, error: 'At least one role is required' }
  }
  const unique = [...new Set(roles)]
  if (unique.some(r => !VALID_ROLES.includes(r))) {
    return { ok: false, error: 'Invalid role in roles array' }
  }
  return { ok: true, roles: unique }
}

/**
 * Lazy migration: persist roles[] from legacy role when missing.
 * Returns the normalized roles array.
 */
export async function ensureProfileRolesMigrated(db, profile) {
  const existing = getProfileRoles(profile)
  if (Array.isArray(profile.roles) && profile.roles.length > 0) {
    return existing
  }
  if (existing.length === 0) return []

  await db.collection('profiles').updateOne(
    { id: profile.id },
    { $set: { roles: existing } }
  )
  return existing
}
