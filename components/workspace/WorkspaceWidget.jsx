'use client'

import { useWorkspace } from './useWorkspace'
import { DASHBOARD_WIDGET_REGISTRY } from './dashboard/DashboardWidgetRegistry'
import { cn } from '@/lib/utils'

const SIZE_CLASSES = {
  small: 'col-span-1',
  medium: 'col-span-1',
  large: 'col-span-2',
  full: 'col-span-full',
}

/**
 * Renders a dashboard widget by workspace id when enabled.
 * Unknown ids render nothing.
 */
export default function WorkspaceWidget({ id, className, ...props }) {
  const { isDashboardEnabled, getWidgetMeta } = useWorkspace()
  if (!isDashboardEnabled(id)) return null

  const Component = DASHBOARD_WIDGET_REGISTRY[id]
  if (!Component) return null

  const meta = getWidgetMeta(id)
  const sizeClass = SIZE_CLASSES[meta.size] || SIZE_CLASSES.medium

  return (
    <div className={cn(sizeClass, meta.collapsed && 'opacity-80', 'h-full w-full', className)}>
      <Component {...props} className="h-full w-full" collapsedDefault={meta.collapsed} refreshPriority={meta.refresh_priority} />
    </div>
  )
}
