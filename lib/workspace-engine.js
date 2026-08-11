/**
 * lib/workspace-engine.js
 *
 * Customizable workspace / role experience configuration per clinic and role.
 * Additive layer — does not replace lib/rbac.js or route-level RBAC.
 */

import { v4 as uuidv4 } from 'uuid'
import { VALID_ROLES } from '@/lib/profile-roles'
import { DEFAULT_ROLE_TEMPLATES } from '@/lib/workspace-template-defaults'
import {
  LAYOUT_DENSITY_OPTIONS,
  LAYOUT_VIEW_OPTIONS,
  LOCKED_NAV_KEYS,
  PATIENT_ACCESS_MODES,
  DASHBOARD_WIDGET_SIZES,
  HOMEPAGE_OPTIONS,
} from '@/lib/workspace-ui-schema'
import {
  normalizeLayoutSection,
  normalizePatientPageSection,
  normalizeHomepageSection,
  normalizePresets,
  createPreset,
  PATIENT_ACCESS,
} from '@/lib/workspace-role-experience'

export { DEFAULT_ROLE_TEMPLATES }

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
  'homepage',
]

export const RESET_SECTIONS = ['dashboard', 'sidebar', 'patient_page', 'actions', 'role', 'all']

const PLATFORM_TEMPLATES_KEY = 'workspace_templates'

const LAYOUT_DENSITIES = LAYOUT_DENSITY_OPTIONS.map(o => o.value)
const LAYOUT_VIEW_MODES = LAYOUT_VIEW_OPTIONS.map(o => o.value)

const BOOLEAN_SECTIONS = new Set([
  'navigation',
  'dashboard',
  'appointment_page',
  'billing_page',
  'inventory_page',
  'lab_page',
  'reports_page',
  'quick_actions',
  'widgets',
  'permissions',
])

function isBooleanMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  return Object.values(obj).every(v => typeof v === 'boolean')
}

function isPatientPageSection(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  return Object.values(obj).every(v => {
    if (typeof v === 'boolean') return true
    return PATIENT_ACCESS_MODES.includes(v)
  })
}

function isHomepageSection(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  if (!obj.landing || typeof obj.landing !== 'string') return false
  return HOMEPAGE_OPTIONS.some(o => o.value === obj.landing)
}

function isLayoutSection(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  for (const [key, value] of Object.entries(obj)) {
    if (['widget_order', 'nav_order', 'quick_action_order'].includes(key)) {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) return false
      continue
    }
    if (key === 'density' && !LAYOUT_DENSITIES.includes(value)) return false
    if (key === 'view_mode' && !LAYOUT_VIEW_MODES.includes(value)) return false
    if (key === 'primary_quick_action' && value != null && typeof value !== 'string') return false
    if (key === 'widget_meta') {
      if (!value || typeof value !== 'object') return false
      for (const meta of Object.values(value)) {
        if (!meta || typeof meta !== 'object') return false
        if (!DASHBOARD_WIDGET_SIZES.includes(meta.size)) return false
        if (typeof meta.collapsed !== 'boolean') return false
        if (!Number.isFinite(meta.refresh_priority)) return false
      }
      continue
    }
    if (key === 'nav_meta') {
      if (!value || typeof value !== 'object') return false
      continue
    }
    if (!['density', 'view_mode', 'primary_quick_action', 'widget_meta', 'nav_meta'].includes(key) && typeof value !== 'boolean') {
      return false
    }
  }
  return true
}

function validateSection(section, value) {
  if (section === 'layout') return isLayoutSection(value)
  if (section === 'patient_page') return isPatientPageSection(value)
  if (section === 'homepage') return isHomepageSection(value)
  if (BOOLEAN_SECTIONS.has(section)) return isBooleanMap(value)
  return isBooleanMap(value)
}

function normalizeRoleConfig(role, partial, defaults) {
  const merged = mergeDefaults(partial, defaults)
  merged.patient_page = normalizePatientPageSection(merged.patient_page)
  merged.layout = normalizeLayoutSection(merged.layout, defaults.layout)
  merged.homepage = normalizeHomepageSection(merged.homepage, role)
  return merged
}

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
    out[role] = normalizeRoleConfig(role, partialTemplates?.[role], baseTemplates[role])
  }
  return out
}

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
  }

  if (workspace.presets != null && !Array.isArray(workspace.presets)) {
    return { ok: false, error: 'presets must be an array', code: 'INVALID_PRESETS' }
  }

  const business = validateWorkspaceBusinessRules(workspace)
  if (!business.ok) return business

  return { ok: true }
}

function mergeStoredWithTemplates(stored, templates) {
  const roles = {}
  for (const role of WORKSPACE_ROLES) {
    roles[role] = normalizeRoleConfig(role, stored[role], templates[role])
  }
  return {
    id: stored.id,
    clinic_id: stored.clinic_id,
    ...roles,
    presets: normalizePresets(stored.presets),
    created_at: stored.created_at,
    updated_at: stored.updated_at,
  }
}

function buildDefaultWorkspaceDoc(clinicId, templates) {
  const merged = mergeRoleTemplates({}, templates)
  return {
    id: uuidv4(),
    clinic_id: clinicId,
    ...merged,
    presets: [],
    created_at: new Date(),
    updated_at: new Date(),
  }
}

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
      workspace: { clinic_id: clinicId, presets: [], ...merged },
      exists: false,
    }
  }

  return {
    ok: true,
    workspace: mergeStoredWithTemplates(stored, templates),
    exists: true,
  }
}

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

export async function saveWorkspace(db, clinicId, workspaceInput, opts = {}) {
  if (!clinicId) {
    return { ok: false, error: 'clinicId is required', code: 'MISSING_CLINIC_ID' }
  }

  const templates = await getPlatformTemplates(db)
  const existing = await db.collection('clinic_workspaces').findOne({ clinic_id: clinicId })

  let nextRoles = {}
  for (const role of WORKSPACE_ROLES) {
    const base = normalizeRoleConfig(role, existing?.[role], templates[role])
    nextRoles[role] = workspaceInput?.[role]
      ? normalizeRoleConfig(role, workspaceInput[role], base)
      : base
  }

  const doc = {
    id: existing?.id || uuidv4(),
    clinic_id: clinicId,
    ...nextRoles,
    presets: opts.presets !== undefined
      ? normalizePresets(opts.presets)
      : normalizePresets(existing?.presets),
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

  return { ok: true, workspace: doc, previous: existing }
}

export async function resetRoleWorkspace(db, clinicId, role) {
  if (!WORKSPACE_ROLES.includes(role)) {
    return { ok: false, error: 'Invalid role', code: 'INVALID_ROLE' }
  }

  const templates = await getPlatformTemplates(db)
  return saveWorkspace(db, clinicId, { [role]: templates[role] })
}

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
    doc.presets = normalizePresets(existing.presets)
  }

  await db.collection('clinic_workspaces').updateOne(
    { clinic_id: clinicId },
    { $set: doc },
    { upsert: true }
  )

  return { ok: true, workspace: doc }
}

/** Reset a specific section for one role back to platform template defaults. */
export async function resetRoleSection(db, clinicId, role, section) {
  if (!WORKSPACE_ROLES.includes(role)) {
    return { ok: false, error: 'Invalid role', code: 'INVALID_ROLE' }
  }

  const sectionMap = {
    dashboard: ['dashboard', 'layout'],
    sidebar: ['navigation', 'layout'],
    patient_page: ['patient_page'],
    actions: ['appointment_page', 'billing_page', 'permissions'],
  }

  const keys = sectionMap[section]
  if (!keys) {
    return { ok: false, error: 'Invalid reset section', code: 'INVALID_SECTION' }
  }

  const templates = await getPlatformTemplates(db)
  const existing = await db.collection('clinic_workspaces').findOne({ clinic_id: clinicId })
  const current = normalizeRoleConfig(role, existing?.[role], templates[role])
  const template = templates[role]

  const patch = { ...current }
  for (const key of keys) {
    if (key === 'layout' && section === 'dashboard') {
      patch.layout = {
        ...current.layout,
        widget_order: template.layout.widget_order,
        widget_meta: template.layout.widget_meta,
      }
    } else if (key === 'layout' && section === 'sidebar') {
      patch.layout = {
        ...current.layout,
        nav_order: template.layout.nav_order,
        nav_meta: template.layout.nav_meta,
      }
    } else {
      patch[key] = template[key]
    }
  }

  return saveWorkspace(db, clinicId, { [role]: patch })
}

export async function saveWorkspacePresets(db, clinicId, presets) {
  const existing = await db.collection('clinic_workspaces').findOne({ clinic_id: clinicId })
  const templates = await getPlatformTemplates(db)

  let nextRoles = {}
  for (const role of WORKSPACE_ROLES) {
    nextRoles[role] = normalizeRoleConfig(role, existing?.[role], templates[role])
  }

  const doc = {
    id: existing?.id || uuidv4(),
    clinic_id: clinicId,
    ...nextRoles,
    presets: normalizePresets(presets),
    created_at: existing?.created_at || new Date(),
    updated_at: new Date(),
  }

  const validation = validateWorkspace(doc, { requireClinicId: true })
  if (!validation.ok) return validation

  await db.collection('clinic_workspaces').updateOne(
    { clinic_id: clinicId },
    { $set: doc },
    { upsert: true }
  )

  return { ok: true, workspace: doc }
}

export async function applyPreset(db, clinicId, presetId, customPresets = null) {
  const result = await getWorkspace(db, clinicId)
  if (!result.ok) return result

  const preset = (customPresets || result.workspace.presets || []).find(p => p.id === presetId)
  if (!preset) {
    return { ok: false, error: 'Preset not found', code: 'PRESET_NOT_FOUND' }
  }

  return saveWorkspace(db, clinicId, { [preset.role]: preset.config })
}

export { createPreset, normalizePresets }

export async function updatePlatformTemplates(db, partialTemplates) {
  if (!partialTemplates || typeof partialTemplates !== 'object') {
    return { ok: false, error: 'templates object is required', code: 'INVALID_TEMPLATES' }
  }

  const current = await getPlatformTemplates(db)
  const merged = mergeRoleTemplates(partialTemplates, current)
  return savePlatformTemplatesRaw(db, merged)
}

/** Migrate legacy boolean patient_page values to access mode strings. */
export function migratePatientPageBooleans(config) {
  if (!config?.patient_page) return config
  const next = { ...config, patient_page: { ...config.patient_page } }
  for (const [key, value] of Object.entries(next.patient_page)) {
    if (value === true) next.patient_page[key] = PATIENT_ACCESS.EDITABLE
    if (value === false) next.patient_page[key] = PATIENT_ACCESS.HIDDEN
  }
  return next
}
