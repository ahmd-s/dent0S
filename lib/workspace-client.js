import { getProfileRoles } from '@/lib/profile-roles'
import { DEFAULT_ROLE_TEMPLATES } from '@/lib/workspace-template-defaults'
import {
  normalizeWidgetOrder,
  HOMEPAGE_OPTIONS,
} from '@/lib/workspace-ui-schema'
import {
  normalizePatientAccess,
  isPatientSectionVisible,
  isPatientSectionEditable,
  isPatientSectionReadonly,
  getOrderedNavigation,
  getOrderedQuickActions,
  getOrderedDashboardWidgets,
  getWidgetMeta,
  getHomepageHref,
  PATIENT_ACCESS,
} from '@/lib/workspace-role-experience'

export {
  normalizePatientAccess,
  isPatientSectionVisible,
  isPatientSectionEditable,
  isPatientSectionReadonly,
  getOrderedNavigation,
  getOrderedQuickActions,
  getOrderedDashboardWidgets,
  getWidgetMeta,
  getHomepageHref,
  PATIENT_ACCESS,
}

export function getEffectiveWorkspaceRole(profileOrRoles) {
  const list = getProfileRoles(profileOrRoles)
  if (list.includes('admin')) return 'admin'
  if (list.includes('doctor')) return 'doctor'
  if (list.includes('receptionist')) return 'receptionist'
  return list[0] || 'admin'
}

export function getLayoutClasses(layout) {
  if (!layout) return ''
  const classes = []
  if (layout.density === 'compact') classes.push('workspace-density-compact')
  if (layout.density === 'comfortable') classes.push('workspace-density-comfortable')
  if (layout.density === 'expanded') classes.push('workspace-density-expanded')
  if (layout.view_mode === 'list') classes.push('workspace-view-list')
  if (layout.view_mode === 'two-column') classes.push('workspace-view-two-column')
  if (layout.view_mode === 'cards') classes.push('workspace-view-cards')
  if (layout.sidebar_collapsed) classes.push('workspace-sidebar-collapsed')
  return classes.join(' ')
}

export function fallbackWorkspaceConfig(role) {
  return DEFAULT_ROLE_TEMPLATES[role] || DEFAULT_ROLE_TEMPLATES.admin
}

export function isNavEnabled(config, key) {
  return config?.navigation?.[key] === true
}

export function isDashboardEnabled(config, key) {
  return config?.dashboard?.[key] === true
}

export function isPatientSectionEnabled(config, key) {
  return isPatientSectionVisible(config, key)
}

export function isQuickActionEnabled(config, key) {
  return config?.quick_actions?.[key] === true
}

export function isActionEnabled(config, section, key) {
  if (section === 'permissions') return config?.permissions?.[key] === true
  return config?.[section]?.[key] === true
}

export function getPrimaryQuickAction(config) {
  const primary = config?.layout?.primary_quick_action
  if (primary && config?.quick_actions?.[primary]) return primary
  const ordered = getOrderedQuickActions(config)
  return ordered[0] || null
}

export function getHomepageLanding(config) {
  return config?.homepage?.landing || 'dashboard'
}

export function resolveHomepageHref(config) {
  const landing = getHomepageLanding(config)
  const option = HOMEPAGE_OPTIONS.find(o => o.value === landing)
  return option?.href || '/dashboard'
}

export function getNavBadgeEnabled(config, key) {
  return config?.layout?.nav_meta?.[key]?.badge_enabled === true
}

export { normalizeWidgetOrder }
