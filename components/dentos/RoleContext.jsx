'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  canManageBilling,
  canEditInvoiceDate,
  canManageInventory,
  canManageStaff,
  canAccessClinical,
  canViewClinical,
  canEditClinical,
  canAccessSettings,
} from '@/lib/rbac'
import { getProfileRoles, hasRole } from '@/lib/profile-roles'

async function redirectPlatformAdmin(router, d) {
  if (!d?.is_platform_admin) return false
  if (d.platform_session_active) {
    router.push('/platform-admin')
    return true
  }
  await fetch('/api/auth/logout', { method: 'POST' })
  router.push('/login')
  return true
}

const RoleContext = createContext(null)

export function RoleProvider({ children }) {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/auth/me')
    const d = await r.json()
    if (!d?.user) {
      router.push('/login')
      return null
    }
    if (await redirectPlatformAdmin(router, d)) return null
    if (!d.clinic?.onboarding_complete) {
      router.push('/onboarding')
      return null
    }
    setMe(d)
    return d
  }, [router])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const r = await fetch('/api/auth/me')
      const d = await r.json()
      if (cancelled) return
      if (!d?.user) {
        router.push('/login')
        setLoading(false)
        return
      }
      if (d.is_platform_admin) {
        if (d.platform_session_active) router.push('/platform-admin')
        else {
          await fetch('/api/auth/logout', { method: 'POST' })
          router.push('/login')
        }
        setLoading(false)
        return
      }
      if (!d.clinic?.onboarding_complete) {
        router.push('/onboarding')
        setLoading(false)
        return
      }
      setMe(d)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [router])

  const value = useMemo(() => {
    const roles = getProfileRoles(me?.profile)
    const roleCtx = roles.length === 1 ? roles[0] : roles

    return {
      me,
      loading,
      refresh,
      roles,
      /** @deprecated use roles — first role for legacy UI */
      currentRole: roles[0] ?? null,
      hasRole: (role) => hasRole(roles, role),
      isDoctor: () => hasRole(roles, 'doctor'),
      isReceptionist: () => hasRole(roles, 'receptionist'),
      isAdmin: () => hasRole(roles, 'admin'),
      canAccessClinical: () => canAccessClinical(roleCtx),
      canViewClinical: () => canViewClinical(roleCtx),
      canEditClinical: () => canEditClinical(roleCtx),
      canAccessSettings: () => canAccessSettings(roleCtx),
      canManageBilling: () => canManageBilling(roleCtx),
      canEditInvoiceDate: () => canEditInvoiceDate(roleCtx),
      canManageInventory: () => canManageInventory(roleCtx),
      canManageStaff: () => canManageStaff(roleCtx),
    }
  }, [me, loading, refresh])

  if (loading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}
