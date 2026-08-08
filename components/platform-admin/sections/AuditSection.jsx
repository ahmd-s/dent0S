'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AuditTimeline } from '@/components/platform-admin/AuditTimeline'
import { SectionHeading } from '@/components/platform-admin/Placeholder'

export default function AuditSection({ clinic }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/platform-admin/audit-log?limit=200')
      if (!r.ok) {
        toast.error('Failed to load audit log')
        return
      }
      const d = await r.json()
      setLogs(d.logs || [])
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const clinicLogs = useMemo(
    () => logs.filter(l => l.target_clinic_id === clinic.id),
    [logs, clinic.id]
  )

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Audit"
        description="Every platform admin action taken on this clinic, newest first."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity timeline</CardTitle>
          <CardDescription>Sourced from the platform admin audit log.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : (
            <AuditTimeline
              logs={clinicLogs}
              showClinic={false}
              emptyLabel="No recorded admin actions for this clinic yet"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
