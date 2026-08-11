'use client'

import { useCallback, useEffect, useState } from 'react'
import { Archive, Database, HardDrive, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RetryErrorFallback } from '@/components/system/GlobalErrorBoundary'

export function BackupCenter() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform-admin/backup')
      if (!res.ok) throw new Error('Failed to load backup status')
      setData(await res.json())
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <RetryErrorFallback error={error} onRetry={load} title="Backup status unavailable" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Backup Center</h2>
          <p className="text-sm text-muted-foreground">Database health, backup status, and restore readiness</p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Restore Ready</CardDescription>
            <CardTitle className="text-lg">
              {data?.restoreReady ? (
                <Badge className="bg-green-100 text-green-800">Ready</Badge>
              ) : (
                <Badge variant="destructive">Not Ready</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Archive className="h-3.5 w-3.5" /> Last Backup</CardDescription>
            <CardTitle className="text-sm font-normal">
              {data?.lastBackup ? new Date(data.lastBackup).toLocaleString('en-IN') : 'Not recorded'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> Storage</CardDescription>
            <CardTitle className="text-sm font-normal">
              {data?.checks?.find(c => c.name === 'Database Size')?.value || '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Backup Status</CardTitle>
          <CardDescription>Atlas continuous backup hooks — no cloud implementation in this sprint</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.checks || []).map(c => (
            <div key={c.name} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
              <span>{c.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{c.value}</span>
                <Badge variant="outline">{c.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="py-4 text-sm text-muted-foreground">
          <p><strong>Cloud backup hooks:</strong> Set <code className="text-xs bg-muted px-1 rounded">ATLAS_BACKUP_ENABLED=true</code> when MongoDB Atlas continuous backup is configured. Record snapshot timestamps via platform settings after manual backups.</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default BackupCenter
