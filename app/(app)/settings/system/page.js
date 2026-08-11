'use client'

import { canAccessSettings } from '@/lib/rbac'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import PageHeader from '@/components/dentos/PageHeader'
import SystemHealthDashboard from '@/components/system/SystemHealthDashboard'
import DiagnosticsPanel from '@/components/system/DiagnosticsPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SystemSettingsPage() {
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
