/**
 * lib/workspace-engine.js
 *
 * Customizable workspace configuration per clinic and role.
 * Additive layer — does not replace lib/rbac.js or route-level RBAC.
 *
 * Design rules:
 *   - Functions accept (db, clinicId, opts) — no HTTP, no auth.
 *   - Returns { ok: true, workspace } or { ok: false, error, code }.
 *   - Missing keys auto-fill from defaults (mergeDefaults).
 *   - New widgets/pages/permissions in defaults apply without migration.
 *   - One document per clinic in clinic_workspaces collection.
 */

import { v4 as uuidv4 } from 'uuid'
import { VALID_ROLES } from '@/lib/profile-roles'
import { DEFAULT_ROLE_TEMPLATES } from '@/lib/workspace-template-defaults'
import {
  LAYOUT_DENSITY_OPTIONS,
  LAYOUT_VIEW_OPTIONS,
  LOCKED_NAV_KEYS,
} from '@/lib/workspace-ui-schema'

export { DEFAULT_ROLE_TEMPLATES }

// ── Constants ─────────────────────────────────────────────────────────────────

export const WORKSPACE_ROLES = VALID_ROLES

export const WORKSPACE_SECTIONS = [
  'navigation',
  'dashboard',
  'patient_page',
  'appointment_page',
  'billing_page',
  'inventory_page',
  'lab_page',
  'reports_page',
  'quick_actions',
  'widgets',
  'permissions',
  'layout',
]

const PLATFORM_TEMPLATES_KEY = 'workspace_templates'

const LAYOUT_DENSITIES = LAYOUT_DENSITY_OPTIONS.map(o => o.value)
const LAYOUT_VIEW_MODES = LAYOUT_VIEW_OPTIONS.map(o => o.value)

// ── Merge & validate ────────────────────────────────────────────────────────────

/**
 * Deep-merge workspace sections. Defaults fill missing keys; stored values win.
 * Unknown keys in partial are preserved for forward compatibility.
 */
export function mergeDefaults(partial, defaults) {
  if (!defaults || typeof defaults !== 'object') return partial ?? {}
  if (!partial || typeof partial !== 'object') return { ...defaults }

  const out = { ...defaults }

  for (const [section, partialSection] of Object.entries(partial)) {
    if (partialSection == null || typeof partialSection !== 'object' || Array.isArray(partialSection)) {
      out[section] = partialSection
      continue
    }

    const defaultSection = defaults[section]
    if (!defaultSection || typeof defaultSection !== 'object' || Array.isArray(defaultSection)) {
      out[section] = { ...partialSection }
      continue
    }

    out[section] = { ...defaultSection, ...partialSection }
  }

  return out
}

function mergeRoleTemplates(partialTemplates, baseTemplates) {
  const out = {}
  for (const role of WORKSPACE_ROLES) {
    out[role] = mergeDefaults(partialTemplates?.[role], baseTemplates[role])
  }
  return out
}

function isBooleanMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  return Object.values(obj).every(v => typeof v === 'boolean')
}

function isLayoutSection(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'widget_order') {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) return false
      continue
    }
    if (key === 'density' && !LAYOUT_DENSITIES.includes(value)) return false
    if (key === 'view_mode' && !LAYOUT_VIEW_MODES.includes(value)) return false
    if (key !== 'density' && key !== 'view_mode' && typeof value !== 'boolean') return false
  }
  return true
}

function validateSection(section, value) {
  if (section === 'layout') return isLayoutSection(value)
  return isBooleanMap(value)
}

/**
 * Business rules for workspace saves (locked nav items, layout enums).
 */
export function validateWorkspaceBusinessRules(workspace) {
  for (const role of WORKSPACE_ROLES) {
    const roleConfig = workspace[role]
    if (!roleConfig) continue

    for (const key of LOCKED_NAV_KEYS) {
      if (roleConfig.navigation?.[key] !== true) {
        return {
          ok: false,
          error: `${role}: ${key} must remain enabled in navigation`,
          code: 'LOCKED_NAV_ITEM',
        }
      }
    }

    const layout = roleConfig.layout
    if (layout?.density && !LAYOUT_DENSITIES.includes(layout.density)) {
      return { ok: false, error: `${role}: invalid layout density`, code: 'INVALID_LAYOUT' }
    }
    if (layout?.view_mode && !LAYOUT_VIEW_MODES.includes(layout.view_mode)) {
      return { ok: false, error: `${role}: invalid layout view mode`, code: 'INVALID_LAYOUT' }
    }
  }

  return { ok: true }
}

/**
 * Validate a full clinic workspace document or role templates map.
 * @param {object} workspace - { admin, doctor, receptionist } or full doc with clinic_id
 * @param {{ requireClinicId?: boolean }} opts
 */
export function validateWorkspace(workspace, opts = {}) {
  if (!workspace || typeof workspace !== 'object') {
    return { ok: false, error: 'Workspace must be an object', code: 'INVALID_WORKSPACE' }
  }

  if (opts.requireClinicId && !workspace.clinic_id) {
    return { ok: false, error: 'clinic_id is required', code: 'MISSING_CLINIC_ID' }
  }

  for (const role of WORKSPACE_ROLES) {
    if (!workspace[role] || typeof workspace[role] !== 'object') {
      return { ok: false, error: `Missing role configuration: ${role}`, code: 'MISSING_ROLE' }
    }

    const roleConfig = workspace[role]

    for (const section of WORKSPACE_SECTIONS) {
      if (!(section in roleConfig)) {
        return { ok: false, error: `Role ${role} missing section: ${section}`, code: 'MISSING_SECTION' }
      }
      if (!validateSection(section, roleConfig[section])) {
        return {
          ok: false,
          error: `Role ${role}.${section} has an invalid configuration`,
          code: 'INVALID_SECTION',
        }
      }
    }

    for (const [section, value] of Object.entries(roleConfig)) {
      if (WORKSPACE_SECTIONS.includes(section)) continue
      if (value != null && typeof value === 'object' && !Array.isArray(value) && !validateSection(section, value)) {
        return {
          ok: false,
          error: `Role ${role}.${section} has an invalid configuration`,
          code: 'INVALID_EXTRA_SECTION',
        }
      }
    }

    const business = validateWorkspaceBusinessRules({ [role]: roleConfig })
    if (!business.ok) return business
  }

  return { ok: true }
}

// ── Platform templates ────────────────────────────────────────────────────────

export async function getPlatformTemplates(db) {
  const settings = await db.collection('platform_settings').findOne({ _type: 'global' })
  const stored = settings?.[PLATFORM_TEMPLATES_KEY]
  return mergeRoleTemplates(stored, DEFAULT_ROLE_TEMPLATES)
}

async function savePlatformTemplatesRaw(db, templates) {
  const merged = mergeRoleTemplates(templates, DEFAULT_ROLE_TEMPLATES)
  const validation = validateWorkspace(merged)
  if (!validation.ok) return validation

  await db.collection('platform_settings').updateOne(
    { _type: 'global' },
    { $set: { [PLATFORM_TEMPLATES_KEY]: merged, updated_at: new Date() } },
    { upsert: true }
  )

  return { ok: true, templates: merged }
}

export async function resetPlatformTemplates(db) {
  await db.collection('platform_settings').updateOne(
    { _type: 'global' },
    { $unset: { [PLATFORM_TEMPLATES_KEY]: '' }, $set: { updated_at: new Date() } }
  )
  return { ok: true, templates: { ...DEFAULT_ROLE_TEMPLATES } }
}

// ── Clinic workspace CRUD ─────────────────────────────────────────────────────

function buildDefaultWorkspaceDoc(clinicId, templates) {
  const merged = mergeRoleTemplates({}, templates)
  return {
    id: uuidv4(),
    clinic_id: clinicId,
    ...merged,
    created_at: new Date(),
    updated_at: new Date(),
  }
}

/**
 * Create default workspace for a new clinic using platform templates.
 */
export async function createDefaultWorkspace(db, clinicId) {
  if (!clinicId) {
    return { ok: false, error: 'clinicId is required', code: 'MISSING_CLINIC_ID' }
  }

  const existing = await db.collection('clinic_workspaces').findOne({ clinic_id: clinicId })
  if (existing) {
    const templates = await getPlatformTemplates(db)
    const workspace = mergeStoredWithTemplates(existing, templates)
    return { ok: true, workspace, created: false }
  }

  const templates = await getPlatformTemplates(db)
  const doc = buildDefaultWorkspaceDoc(clinicId, templates)
  const validation = validateWorkspace(doc, { requireClinicId: true })
  if (!validation.ok) return validation

  await db.collection('clinic_workspaces').insertOne(doc)
  return { ok: true, workspace: doc, created: true }
}

function mergeStoredWithTemplates(stored, templates) {
  const roles = {}
  for (const role of WORKSPACE_ROLES) {
    roles[role] = mergeDefaults(stored[role], templates[role])
  }
  return {
    id: stored.id,
    clinic_id: stored.clinic_id,
    ...roles,
    created_at: stored.created_at,
    updated_at: stored.updated_at,
  }
}

/**
 * Get merged workspace for a clinic (stored + current platform defaults).
 */
export async function getWorkspace(db, clinicId) {
  if (!clinicId) {
    return { ok: false, error: 'clinicId is required', code: 'MISSING_CLINIC_ID' }
  }

  const stored = await db.collection('clinic_workspaces').findOne({ clinic_id: clinicId })
  const templates = await getPlatformTemplates(db)

  if (!stored) {
    const merged = mergeRoleTemplates({}, templates)
    return {
      ok: true,
      workspace: { clinic_id: clinicId, ...merged },
      exists: false,
    }
  }

  return {
    ok: true,
    workspace: mergeStoredWithTemplates(stored, templates),
    exists: true,
  }
}

/**
 * Get merged workspace config for a single role.
 */
export async function getRoleWorkspace(db, clinicId, role) {
  if (!WORKSPACE_ROLES.includes(role)) {
    return { ok: false, error: 'Invalid role', code: 'INVALID_ROLE' }
  }

  const result = await getWorkspace(db, clinicId)
  if (!result.ok) return result

  return {
    ok: true,
    role,
    config: result.workspace[role],
    exists: result.exists,
  }
}

/**
 * Save clinic workspace (full or partial role update).
 * Partial role configs are merged with platform defaults before save.
 */
export async function saveWorkspace(db, clinicId, workspaceInput) {
  if (!clinicId) {
    return { ok: false, error: 'clinicId is required', code: 'MISSING_CLINIC_ID' }
  }

  const templates = await getPlatformTemplates(db)
  const existing = await db.collection('clinic_workspaces').findOne({ clinic_id: clinicId })

  let nextRoles = {}
  for (const role of WORKSPACE_ROLES) {
    const base = mergeDefaults(existing?.[role], templates[role])
    nextRoles[role] = workspaceInput?.[role]
      ? mergeDefaults(workspaceInput[role], base)
      : base
  }

  const doc = {
    id: existing?.id || uuidv4(),
    clinic_id: clinicId,
    ...nextRoles,
    created_at: existing?.created_at || new Date(),
    updated_at: new Date(),
  }

  const validation = validateWorkspace(doc, { requireClinicId: true })
  if (!validation.ok) return validation

  const business = validateWorkspaceBusinessRules(doc)
  if (!business.ok) return business

  await db.collection('clinic_workspaces').updateOne(
    { clinic_id: clinicId },
    { $set: doc },
    { upsert: true }
  )

  return { ok: true, workspace: doc }
}

/**
 * Reset a single role to current platform templates.
 */
export async function resetRoleWorkspace(db, clinicId, role) {
  if (!WORKSPACE_ROLES.includes(role)) {
    return { ok: false, error: 'Invalid role', code: 'INVALID_ROLE' }
  }

  const templates = await getPlatformTemplates(db)
  return saveWorkspace(db, clinicId, { [role]: templates[role] })
}

/**
 * Reset a clinic workspace to current platform templates.
 */
export async function resetClinicWorkspace(db, clinicId) {
  if (!clinicId) {
    return { ok: false, error: 'clinicId is required', code: 'MISSING_CLINIC_ID' }
  }

  const templates = await getPlatformTemplates(db)
  const doc = buildDefaultWorkspaceDoc(clinicId, templates)
  doc.updated_at = new Date()

  const existing = await db.collection('clinic_workspaces').findOne({ clinic_id: clinicId })
  if (existing) {
    doc.id = existing.id
    doc.created_at = existing.created_at
  }

  await db.collection('clinic_workspaces').updateOne(
    { clinic_id: clinicId },
    { $set: doc },
    { upsert: true }
  )

  return { ok: true, workspace: doc }
}

/**
 * Update platform-wide templates (partial merge). Used by platform admin.
 */
export async function updatePlatformTemplates(db, partialTemplates) {
  if (!partialTemplates || typeof partialTemplates !== 'object') {
    return { ok: false, error: 'templates object is required', code: 'INVALID_TEMPLATES' }
  }

  const current = await getPlatformTemplates(db)
  const merged = mergeRoleTemplates(partialTemplates, current)
  return savePlatformTemplatesRaw(db, merged)
}
