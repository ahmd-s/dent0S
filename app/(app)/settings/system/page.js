'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/components/dentos/RoleContext'
import PageHeader from '@/components/dentos/PageHeader'
import SystemHealthDashboard from '@/components/system/SystemHealthDashboard'
import DiagnosticsPanel from '@/components/system/DiagnosticsPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SystemSettingsPage() {
  const router = useRouter()
  // Permission comes from RoleProvider's already-loaded session rather than a
  // second /api/auth/me round-trip behind a spinner.
  const { canAccessSettings } = useRole()
  const allowed = canAccessSettings()

  useEffect(() => {
    if (!allowed) router.replace('/dashboard?error=unauthorized')
  }, [allowed, router])

  if (!allowed) return null

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="System Health"
        description="Monitor database connectivity, background jobs, integrations, and run production diagnostics."
        backHref="/settings"
        backLabel="Settings"
      />
      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        <TabsContent value="health" className="mt-6">
          <SystemHealthDashboard />
        </TabsContent>
        <TabsContent value="diagnostics" className="mt-6">
          <DiagnosticsPanel scope="clinic" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
