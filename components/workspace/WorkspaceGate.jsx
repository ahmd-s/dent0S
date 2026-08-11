'use client'

import { useWorkspace } from './useWorkspace'

/**
 * Conditionally render children based on workspace configuration.
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

/**
 * Patient section gate with read-only support.
 * Wraps editable controls — pass readOnlyContent for view-only rendering.
 */
export function PatientSectionGate({ flag, children, readOnlyContent = null }) {
  const ws = useWorkspace()
  if (!ws.isPatientSectionEnabled(flag)) return null
  if (ws.isPatientSectionReadonly(flag) && readOnlyContent != null) {
    return readOnlyContent
  }
  return children
}

/**
 * Action gate — checks module action permissions from workspace config.
 */
export function ActionGate({ moduleSection, flag, children }) {
  const ws = useWorkspace()
  if (!ws.isActionEnabled(moduleSection, flag)) return null
  return children
}
