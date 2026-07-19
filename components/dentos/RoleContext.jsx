'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { canManageBilling, canManageInventory, canManageStaff, canAccessClinical, canAccessSettings } from '@/lib/rbac'

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
    const role = me?.profile?.role ?? null
    const isDoctor = () => role === 'doctor'
    const isReceptionist = () => role === 'receptionist'
    const isAdmin = () => role === 'admin'
    const canAccessClinicalInternal = () => canAccessClinical(role)
    const canAccessSettingsInternal = () => canAccessSettings(role)
    const canManageBillingInternal = () => canManageBilling(role)
    const canManageInventoryInternal = () => canManageInventory(role)
    const canManageStaffInternal = () => canManageStaff(role)
    return {
      me,
      loading,
      refresh,
      currentRole: role,
      isDoctor,
      isReceptionist,
      isAdmin,
      canAccessClinical: canAccessClinicalInternal,
      canAccessSettings: canAccessSettingsInternal,
      canManageBilling: canManageBillingInternal,
      canManageInventory: canManageInventoryInternal,
      canManageStaff: canManageStaffInternal,
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
