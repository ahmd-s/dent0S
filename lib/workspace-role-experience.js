/**
 * Role Experience helpers — normalization, ordering, access modes, presets.
 * Extends workspace-engine without a separate configuration store.
 */

import { v4 as uuidv4 } from 'uuid'
import {
  DEFAULT_WIDGET_ORDER,
  DEFAULT_NAV_ORDER,
  DEFAULT_QUICK_ACTION_ORDER,
  PATIENT_ACCESS_MODES,
  DASHBOARD_WIDGET_SIZES,
  HOMEPAGE_OPTIONS,
} from '@/lib/workspace-ui-schema'

export const PATIENT_ACCESS = {
  HIDDEN: 'hidden',
  READONLY: 'readonly',
  EDITABLE: 'editable',
}

/** Normalize legacy boolean patient_page values to access modes. */
export function normalizePatientAccess(value) {
  if (value === true || value === PATIENT_ACCESS.EDITABLE) return PATIENT_ACCESS.EDITABLE
  if (value === 'read_only' || value === PATIENT_ACCESS.READONLY) return PATIENT_ACCESS.READONLY
  if (value === false || value === PATIENT_ACCESS.HIDDEN) return PATIENT_ACCESS.HIDDEN
  if (PATIENT_ACCESS_MODES.includes(value)) return value
  return PATIENT_ACCESS.HIDDEN
}

export function isPatientSectionVisible(config, key) {
  const mode = normalizePatientAccess(config?.patient_page?.[key])
  return mode !== PATIENT_ACCESS.HIDDEN
}

export function isPatientSectionEditable(config, key) {
  return normalizePatientAccess(config?.patient_page?.[key]) === PATIENT_ACCESS.EDITABLE
}

export function isPatientSectionReadonly(config, key) {
  return normalizePatientAccess(config?.patient_page?.[key]) === PATIENT_ACCESS.READONLY
}

export function normalizePatientPageSection(partial = {}) {
  const out = {}
  for (const [key, value] of Object.entries(partial)) {
    out[key] = normalizePatientAccess(value)
  }
  return out
}

export function mergePatientPageSection(defaults, partial) {
  const base = normalizePatientPageSection(defaults || {})
  const over = normalizePatientPageSection(partial || {})
  return { ...base, ...over }
}

export function normalizeNavOrder(order) {
  const base = Array.isArray(order) ? [...order] : []
  const seen = new Set(base)
  for (const key of DEFAULT_NAV_ORDER) {
    if (!seen.has(key)) base.push(key)
  }
  return base.filter(k => DEFAULT_NAV_ORDER.includes(k))
}

export function normalizeQuickActionOrder(order) {
  const base = Array.isArray(order) ? [...order] : []
  const seen = new Set(base)
  for (const key of DEFAULT_QUICK_ACTION_ORDER) {
    if (!seen.has(key)) base.push(key)
  }
  return base.filter(k => DEFAULT_QUICK_ACTION_ORDER.includes(k))
}

export function defaultWidgetMeta(key) {
  return {
    size: 'medium',
    collapsed: false,
    refresh_priority: DEFAULT_WIDGET_ORDER.indexOf(key) + 1 || 99,
  }
}

export function normalizeWidgetMeta(partial = {}) {
  const out = {}
  for (const key of DEFAULT_WIDGET_ORDER) {
    const item = partial[key] || {}
    const size = DASHBOARD_WIDGET_SIZES.includes(item.size) ? item.size : 'medium'
    out[key] = {
      size,
      collapsed: item.collapsed === true,
      refresh_priority: Number.isFinite(item.refresh_priority) ? item.refresh_priority : defaultWidgetMeta(key).refresh_priority,
    }
  }
  return out
}

export function normalizeNavMeta(partial = {}) {
  const out = {}
  for (const key of DEFAULT_NAV_ORDER) {
    out[key] = { badge_enabled: partial[key]?.badge_enabled === true }
  }
  return { ...out, ...partial }
}

export function normalizeLayoutSection(partial = {}, defaults = {}) {
  const merged = { ...defaults, ...partial }
  return {
    density: merged.density || 'comfortable',
    view_mode: merged.view_mode || 'cards',
    widget_order: normalizeWidgetOrder(merged.widget_order),
    nav_order: normalizeNavOrder(merged.nav_order),
    quick_action_order: normalizeQuickActionOrder(merged.quick_action_order),
    primary_quick_action: merged.primary_quick_action || null,
    widget_meta: normalizeWidgetMeta(merged.widget_meta),
    nav_meta: normalizeNavMeta(merged.nav_meta),
    sidebar_collapsed: merged.sidebar_collapsed === true,
    compact_mode: merged.compact_mode === true,
  }
}

export function normalizeWidgetOrder(order) {
  const base = Array.isArray(order) ? [...order] : []
  const seen = new Set(base)
  for (const key of DEFAULT_WIDGET_ORDER) {
    if (!seen.has(key)) base.push(key)
  }
  return base.filter(k => DEFAULT_WIDGET_ORDER.includes(k))
}

export function normalizeHomepageSection(partial = {}, role = 'admin') {
  const landing = partial?.landing || getDefaultHomepageForRole(role)
  const valid = HOMEPAGE_OPTIONS.some(o => o.value === landing)
  return { landing: valid ? landing : 'dashboard' }
}

export function getDefaultHomepageForRole(role) {
  if (role === 'doctor') return 'dashboard'
  if (role === 'receptionist') return 'appointments'
  return 'dashboard'
}

export function getOrderedNavigation(config) {
  if (!config?.navigation) return []
  const order = normalizeNavOrder(config.layout?.nav_order)
  return order.filter(key => config.navigation[key] === true)
}

export function getOrderedQuickActions(config) {
  if (!config?.quick_actions) return []
  const order = normalizeQuickActionOrder(config.layout?.quick_action_order)
  return order.filter(key => config.quick_actions[key] === true)
}

export function getOrderedDashboardWidgets(config) {
  if (!config) return []
  const order = normalizeWidgetOrder(config.layout?.widget_order)
  const enabled = order.filter(id => config.dashboard?.[id] === true)
  return enabled.sort((a, b) => {
    const pa = config.layout?.widget_meta?.[a]?.refresh_priority ?? 99
    const pb = config.layout?.widget_meta?.[b]?.refresh_priority ?? 99
    return pa - pb
  })
}

export function getWidgetMeta(config, widgetId) {
  return config?.layout?.widget_meta?.[widgetId] || defaultWidgetMeta(widgetId)
}

export function getHomepageHref(config) {
  const landing = config?.homepage?.landing || 'dashboard'
  const option = HOMEPAGE_OPTIONS.find(o => o.value === landing)
  return option?.href || '/dashboard'
}

/** Built-in role experience presets (stored names; config applied on demand). */
export const BUILTIN_PRESETS = [
  { id: 'minimal-doctor', name: 'Minimal Doctor', role: 'doctor' },
  { id: 'ai-doctor', name: 'AI Doctor', role: 'doctor' },
  { id: 'front-desk-lite', name: 'Front Desk Lite', role: 'receptionist' },
  { id: 'front-desk-premium', name: 'Front Desk Premium', role: 'receptionist' },
  { id: 'owner', name: 'Owner', role: 'admin' },
]

export function createPreset({ name, role, config }) {
  return {
    id: uuidv4(),
    name: String(name || 'Untitled preset').trim(),
    role,
    config: JSON.parse(JSON.stringify(config)),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function normalizePresets(presets) {
  if (!Array.isArray(presets)) return []
  return presets
    .filter(p => p && p.id && p.role && p.config)
    .map(p => ({
      id: p.id,
      name: String(p.name || 'Preset'),
      role: p.role,
      config: p.config,
      created_at: p.created_at || new Date().toISOString(),
      updated_at: p.updated_at || new Date().toISOString(),
    }))
}

/** Diff two role configs for audit logging. */
export function diffRoleConfig(before, after, role) {
  const changes = []
  if (!before || !after) return changes

  const sections = [
    'navigation', 'dashboard', 'patient_page', 'appointment_page', 'billing_page',
    'inventory_page', 'lab_page', 'reports_page', 'quick_actions', 'widgets',
    'permissions', 'layout', 'homepage',
  ]

  for (const section of sections) {
    const a = before[section]
    const b = after[section]
    if (JSON.stringify(a) === JSON.stringify(b)) continue

    if (section === 'patient_page') {
      const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
      for (const key of keys) {
        const from = normalizePatientAccess(a?.[key])
        const to = normalizePatientAccess(b?.[key])
        if (from !== to) {
          changes.push({ role, section: 'Patient Page', field: key, from, to })
        }
      }
      continue
    }

    if (section === 'layout') {
      changes.push({ role, section: 'Layout', field: section, from: '…', to: 'updated' })
      continue
    }

    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
    for (const key of keys) {
      if (a?.[key] !== b?.[key]) {
        changes.push({
          role,
          section: section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          field: key,
          from: a?.[key],
          to: b?.[key],
        })
      }
    }
  }

  return changes
}

export function buildBuiltinPresetConfig(presetId, templates) {
  const admin = templates.admin
  const doctor = templates.doctor
  const receptionist = templates.receptionist

  switch (presetId) {
    case 'minimal-doctor':
      return {
        ...doctor,
        dashboard: { ...doctor.dashboard, revenue: false, pending_bills: false, ai_summary: false, inventory_alerts: false },
        navigation: { ...doctor.navigation, inventory: false, labs: false, reports: false },
        quick_actions: { ...doctor.quick_actions, generate_ai_summary: false, new_lab_case: false },
      }
    case 'ai-doctor':
      return {
        ...doctor,
        navigation: { ...doctor.navigation, ai: true },
        dashboard: { ...doctor.dashboard, ai_summary: true },
        quick_actions: { ...doctor.quick_actions, generate_ai_summary: true },
      }
    case 'front-desk-lite':
      return {
        ...receptionist,
        navigation: { ...receptionist.navigation, inventory: false, labs: false },
        dashboard: { ...receptionist.dashboard, lab_cases: false, followups: false },
      }
    case 'front-desk-premium':
      return {
        ...receptionist,
        navigation: { ...receptionist.navigation, billing: true, labs: true },
        dashboard: { ...receptionist.dashboard, revenue: true, pending_bills: true, lab_cases: true },
        homepage: { landing: 'appointments' },
      }
    case 'owner':
      return { ...admin }
    default:
      return null
  }
}
