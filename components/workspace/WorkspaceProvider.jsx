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
} from '@/lib/workspace-client'

export function WorkspaceProvider({ children }) {
  const { me, roles } = useRole()
  const [workspace, setWorkspace] = useState(null)
  const [role, setRole] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  /** Visual-only preview role (builder); live app uses effective role unless preview set */
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
      isNavEnabled: key => activeConfig?.navigation?.[key] === true,
      isDashboardEnabled: key => activeConfig?.dashboard?.[key] === true,
      isPatientSectionEnabled: key => activeConfig?.patient_page?.[key] === true,
      isQuickActionEnabled: key => activeConfig?.quick_actions?.[key] === true,
    }
  }, [workspace, activeConfig, effectiveRole, loading, error, previewRole, refreshWorkspace])

  if (loading) {
    return (
      <WorkspaceContext.Provider value={value}>
        {children}
      </WorkspaceContext.Provider>
    )
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
