'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/components/dentos/RoleContext'
import PageHeader from '@/components/dentos/PageHeader'
import WorkspaceBuilder from '@/components/settings/workspace/WorkspaceBuilder'

export default function WorkspaceBuilderPage() {
  const router = useRouter()
  // RoleProvider has already resolved the session, so the permission check is
  // synchronous. Re-fetching /api/auth/me here cost a round-trip and showed a
  // spinner for an answer that was already in memory.
  const { canAccessSettings } = useRole()
  const allowed = canAccessSettings()

  useEffect(() => {
    if (!allowed) router.replace('/dashboard?error=unauthorized')
  }, [allowed, router])

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
