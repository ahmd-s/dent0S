'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRole } from '@/components/dentos/RoleContext'
import { WorkspaceContext } from './WorkspaceContext'
import {
  fallbackWorkspaceConfig,
  getEffectiveWorkspaceRole,
  getLayoutClasses,
  getOrderedDashboardWidgets,
  getOrderedNavigation,
  getOrderedQuickActions,
  getWidgetMeta,
  getPrimaryQuickAction,
  getHomepageLanding,
  resolveHomepageHref,
  getNavBadgeEnabled,
  isPatientSectionVisible,
  isPatientSectionEditable,
  isPatientSectionReadonly,
  isActionEnabled,
} from '@/lib/workspace-client'

export function WorkspaceProvider({ children }) {
  const { me, roles } = useRole()
  const [workspace, setWorkspace] = useState(null)
  const [role, setRole] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [previewRole, setPreviewRole] = useState(null)

  const effectiveRole = useMemo(
    () => previewRole || role || getEffectiveWorkspaceRole(roles),
    [previewRole, role, roles]
  )

  const refreshWorkspace = useCallback(async () => {
    setError(null)
    try {
      const r = await fetch('/api/workspace')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load workspace')
      setWorkspace(d.workspace)
      setRole(d.role)
      setConfig(d.config)
      return d
    } catch (e) {
      const fallbackRole = getEffectiveWorkspaceRole(roles)
      const fallback = fallbackWorkspaceConfig(fallbackRole)
      setWorkspace(null)
      setRole(fallbackRole)
      setConfig(fallback)
      setError(e.message)
      return null
    }
  }, [roles])

  useEffect(() => {
    if (!me) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await refreshWorkspace()
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [me, refreshWorkspace])

  useEffect(() => {
    const onUpdated = () => { refreshWorkspace() }
    window.addEventListener('dentos:workspace-updated', onUpdated)
    return () => window.removeEventListener('dentos:workspace-updated', onUpdated)
  }, [refreshWorkspace])

  const activeConfig = useMemo(() => {
    if (!config && !workspace) return fallbackWorkspaceConfig(effectiveRole)
    if (workspace && effectiveRole) {
      return workspace[effectiveRole] || config || fallbackWorkspaceConfig(effectiveRole)
    }
    return config || fallbackWorkspaceConfig(effectiveRole)
  }, [config, workspace, effectiveRole])

  const value = useMemo(() => {
    const layoutClasses = getLayoutClasses(activeConfig?.layout)
    const navigationOrder = getOrderedNavigation(activeConfig)
    const dashboardWidgets = getOrderedDashboardWidgets(activeConfig)
    const quickActions = getOrderedQuickActions(activeConfig)

    return {
      workspace,
      config: activeConfig,
      role: effectiveRole,
      loading,
      error,
      previewRole,
      setPreviewRole,
      refreshWorkspace,
      layoutClasses,
      navigationOrder,
      dashboardWidgets,
      quickActions,
      primaryQuickAction: getPrimaryQuickAction(activeConfig),
      homepageLanding: getHomepageLanding(activeConfig),
      homepageHref: resolveHomepageHref(activeConfig),
      isNavEnabled: key => activeConfig?.navigation?.[key] === true,
      isDashboardEnabled: key => activeConfig?.dashboard?.[key] === true,
      isPatientSectionEnabled: key => isPatientSectionVisible(activeConfig, key),
      isPatientSectionEditable: key => isPatientSectionEditable(activeConfig, key),
      isPatientSectionReadonly: key => isPatientSectionReadonly(activeConfig, key),
      isQuickActionEnabled: key => activeConfig?.quick_actions?.[key] === true,
      isActionEnabled: (section, key) => isActionEnabled(activeConfig, section, key),
      getWidgetMeta: key => getWidgetMeta(activeConfig, key),
      isNavBadgeEnabled: key => getNavBadgeEnabled(activeConfig, key),
      sidebarCollapsedDefault: activeConfig?.layout?.sidebar_collapsed === true,
    }
  }, [workspace, activeConfig, effectiveRole, loading, error, previewRole, refreshWorkspace])

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
