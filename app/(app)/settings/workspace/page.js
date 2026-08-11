'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { canAccessSettings } from '@/lib/rbac'
import PageHeader from '@/components/dentos/PageHeader'
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!allowed) return null

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Role Experience Builder"
        description="Design dashboard, sidebar, patient page, and actions per role."
        backHref="/settings"
        backLabel="Settings"
      />
      <WorkspaceBuilder />
    </div>
  )
}
