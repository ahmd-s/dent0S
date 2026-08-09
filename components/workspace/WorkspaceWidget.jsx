'use client'

import { useWorkspace } from './useWorkspace'
import { DASHBOARD_WIDGET_REGISTRY } from './dashboard/DashboardWidgetRegistry'

/**
 * Renders a dashboard widget by workspace id when enabled.
 * Unknown ids render nothing.
 */
export default function WorkspaceWidget({ id, ...props }) {
  const { isDashboardEnabled } = useWorkspace()
  if (!isDashboardEnabled(id)) return null

  const Component = DASHBOARD_WIDGET_REGISTRY[id]
  if (!Component) return null

  return <Component {...props} />
}
