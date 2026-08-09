import { getProfileRoles } from '@/lib/profile-roles'
import { DEFAULT_ROLE_TEMPLATES } from '@/lib/workspace-template-defaults'
import { normalizeWidgetOrder, NAVIGATION_FIELDS } from '@/lib/workspace-ui-schema'

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

export function getOrderedNavigation(config) {
  if (!config?.navigation) return []
  return NAVIGATION_FIELDS.filter(f => config.navigation[f.key] === true).map(f => f.key)
}

export function getOrderedDashboardWidgets(config) {
  if (!config) return []
  const order = normalizeWidgetOrder(config.layout?.widget_order)
  return order.filter(id => config.dashboard?.[id] === true)
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
  return config?.patient_page?.[key] === true
}

export function isQuickActionEnabled(config, key) {
  return config?.quick_actions?.[key] === true
}
