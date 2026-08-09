'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { canAccessSettings } from '@/lib/rbac'
import WorkspaceBuilder from '@/components/settings/workspace/WorkspaceBuilder'

export default function WorkspaceBuilderPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(me => {
        if (!me?.profile || !canAccessSettings(me.profile)) {
          router.replace('/dashboard?error=unauthorized')
          setAllowed(false)
        } else {
          setAllowed(true)
        }
      })
      .catch(() => {
        router.replace('/dashboard?error=unauthorized')
        setAllowed(false)
      })
  }, [router])

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
      </div>
    )
  }

  if (!allowed) return null

  return <WorkspaceBuilder />
}
