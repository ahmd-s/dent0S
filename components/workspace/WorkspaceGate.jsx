'use client'

import { useWorkspace } from './useWorkspace'

/**
 * Conditionally render children based on workspace configuration.
 *
 * @param {string} [module] - Navigation module key (e.g. "inventory")
 * @param {string} [section] - Config section (navigation, dashboard, patient_page, quick_actions)
 * @param {string} [flag] - Boolean key within section (required with section)
 */
export default function WorkspaceGate({ module, section, flag, children }) {
  const ws = useWorkspace()

  let enabled = true

  if (module) {
    enabled = ws.isNavEnabled(module)
  } else if (section === 'navigation' && flag) {
    enabled = ws.isNavEnabled(flag)
  } else if (section === 'dashboard' && flag) {
    enabled = ws.isDashboardEnabled(flag)
  } else if (section === 'patient_page' && flag) {
    enabled = ws.isPatientSectionEnabled(flag)
  } else if (section === 'quick_actions' && flag) {
    enabled = ws.isQuickActionEnabled(flag)
  } else if (section && flag) {
    enabled = ws.config?.[section]?.[flag] === true
  }

  if (!enabled) return null
  return children
}
