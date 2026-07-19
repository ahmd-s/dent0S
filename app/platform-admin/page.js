'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const PLATFORM_STATUS_OPTIONS = [
  { value: 'none', label: 'No override' },
  { value: 'active', label: 'Active' },
  { value: 'comped', label: 'Comped' },
  { value: 'locked', label: 'Locked' },
]

const fmtDate = d => {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fmtDateTime = d => {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

const fmtAction = action => action.replace(/_/g, ' ')

function StatusBadge({ active }) {
  return active
    ? <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">Active</Badge>
    : <Badge variant="secondary">Inactive</Badge>
}

export default function PlatformAdminPage() {
  const [loading, setLoading] = useState(true)
  const [funnel, setFunnel] = useState(null)
  const [clinics, setClinics] = useState([])
  const [inactive, setInactive] = useState([])
  const [logs, setLogs] = useState([])
  const [savingId, setSavingId] = useState(null)
  const [draftStatus, setDraftStatus] = useState({})

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [funnelRes, clinicsRes, healthRes, auditRes] = await Promise.all([
        fetch('/api/platform-admin/funnel'),
        fetch('/api/platform-admin/clinics'),
        fetch('/api/platform-admin/health'),
        fetch('/api/platform-admin/audit-log?limit=100'),
      ])
      if (!funnelRes.ok || !clinicsRes.ok || !healthRes.ok || !auditRes.ok) {
        toast.error('Failed to load platform admin data')
        return
      }
      const [funnelData, clinicsData, healthData, auditData] = await Promise.all([
        funnelRes.json(),
        clinicsRes.json(),
        healthRes.json(),
        auditRes.json(),
      ])
      setFunnel(funnelData)
      setClinics(clinicsData.clinics || [])
      setInactive(healthData.inactive_clinics || [])
      setLogs(auditData.logs || [])
      const drafts = {}
      for (const c of clinicsData.clinics || []) {
        drafts[c.id] = c.platform_status || 'none'
      }
      setDraftStatus(drafts)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const saveStatus = async clinic => {
    const val = draftStatus[clinic.id]
    const platform_status = val === 'none' ? null : val
    setSavingId(clinic.id)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_status }),
      })
      if (!r.ok) {
        toast.error('Failed to update status')
        return
      }
      toast.success(`Updated ${clinic.name}`)
      await loadAll()
    } catch {
      toast.error('Network error')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Clinic-level metadata only — no patient or clinical records.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total signups</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{funnel?.total_signups ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completed onboarding</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{funnel?.completed_onboarding ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Has real activity</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{funnel?.has_real_activity ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Clinics with at least one visit</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clinics">
        <TabsList>
          <TabsTrigger value="clinics">Clinics</TabsTrigger>
          <TabsTrigger value="health">Usage health</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="clinics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Clinics directory</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Clinic</th>
                    <th className="py-2 pr-4 font-medium">Signed up</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Plan</th>
                    <th className="py-2 pr-4 font-medium">Billing</th>
                    <th className="py-2 pr-4 font-medium">Manual override</th>
                    <th className="py-2 pr-4 font-medium">Last activity</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No clinics yet</td></tr>
                  )}
                  {clinics.map(c => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{c.name}</div>
                        {!c.onboarding_complete && (
                          <span className="text-xs text-amber-600">Onboarding incomplete</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">{fmtDate(c.created_at)}</td>
                      <td className="py-3 pr-4"><StatusBadge active={c.is_active} /></td>
                      <td className="py-3 pr-4 capitalize">{c.plan_type || '—'}</td>
                      <td className="py-3 pr-4 capitalize">{c.subscription_status || '—'}</td>
                      <td className="py-3 pr-4">
                        <Select
                          value={draftStatus[c.id] || 'none'}
                          onValueChange={v => setDraftStatus(s => ({ ...s, [c.id]: v }))}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORM_STATUS_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{fmtDateTime(c.last_activity)}</td>
                      <td className="py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={savingId === c.id}
                          onClick={() => saveStatus(c)}
                        >
                          {savingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Inactive 14+ days</CardTitle>
              <p className="text-sm text-muted-foreground">No visits recorded in the last 14 days</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Clinic</th>
                    <th className="py-2 pr-4 font-medium">Clinic status</th>
                    <th className="py-2 pr-4 font-medium">Last visit</th>
                    <th className="py-2 font-medium">Days since visit</th>
                  </tr>
                </thead>
                <tbody>
                  {inactive.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">All clinics have recent visit activity</td></tr>
                  )}
                  {inactive.map(c => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium">{c.name}</td>
                      <td className="py-3 pr-4"><StatusBadge active={c.is_active} /></td>
                      <td className="py-3 pr-4">{fmtDate(c.last_visit_date)}</td>
                      <td className="py-3">{c.days_since_last_visit ?? 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
              <p className="text-sm text-muted-foreground">Panel actions and platform admin login events</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Action</th>
                    <th className="py-2 pr-4 font-medium">Actor</th>
                    <th className="py-2 pr-4 font-medium">Clinic</th>
                    <th className="py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No audit entries yet</td></tr>
                  )}
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 whitespace-nowrap">{fmtDateTime(log.at)}</td>
                      <td className="py-3 pr-4 capitalize">{fmtAction(log.action)}</td>
                      <td className="py-3 pr-4">{log.actor_email || '—'}</td>
                      <td className="py-3 pr-4">{log.target_clinic_name || '—'}</td>
                      <td className="py-3 text-muted-foreground">
                        {log.meta?.ip && <span>IP: {log.meta.ip}</span>}
                        {log.meta?.from !== undefined && (
                          <span>{log.meta.from ?? 'none'} → {log.meta.to ?? 'none'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
