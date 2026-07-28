'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const fmtMoney = n => {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function StatusBadge({ active }) {
  return active
    ? <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">Active</Badge>
    : <Badge variant="secondary">Inactive</Badge>
}

function AccessBadge({ status }) {
  const blocked = status === 'blocked'
  return blocked
    ? <Badge variant="destructive">Blocked</Badge>
    : <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">Active</Badge>
}

function AuditDetails({ log }) {
  const parts = []
  if (log.meta?.ip) parts.push(`IP: ${log.meta.ip}`)
  if (log.meta?.from !== undefined) {
    parts.push(`${log.meta.from ?? 'none'} → ${log.meta.to ?? 'none'}`)
  }
  if (log.meta?.amount != null) {
    parts.push(`${fmtMoney(log.meta.amount)} via ${log.meta.method || '—'}`)
    if (log.meta.date) parts.push(`date ${log.meta.date}`)
  }
  if (!parts.length) return '—'
  return parts.join(' · ')
}

export default function PlatformAdminPage() {
  const [loading, setLoading] = useState(true)
  const [funnel, setFunnel] = useState(null)
  const [clinics, setClinics] = useState([])
  const [inactive, setInactive] = useState([])
  const [logs, setLogs] = useState([])
  const [savingId, setSavingId] = useState(null)
  const [draftStatus, setDraftStatus] = useState({})
  const [accessSavingId, setAccessSavingId] = useState(null)
  const [manageClinic, setManageClinic] = useState(null)
  const [payments, setPayments] = useState([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [aiLimitDraft, setAiLimitDraft] = useState('')
  const [aiLimitSaving, setAiLimitSaving] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ date: '', amount: '', method: '', note: '' })

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

  const loadPayments = useCallback(async clinicId => {
    setPaymentsLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinicId}/payments`)
      if (!r.ok) {
        toast.error('Failed to load payments')
        return
      }
      const d = await r.json()
      setPayments(d.payments || [])
    } catch {
      toast.error('Network error')
    } finally {
      setPaymentsLoading(false)
    }
  }, [])

  const openManage = clinic => {
    setManageClinic(clinic)
    setAiLimitDraft(
      clinic.monthly_ai_usage_limit != null ? String(clinic.monthly_ai_usage_limit) : ''
    )
    setPaymentForm({ date: new Date().toISOString().slice(0, 10), amount: '', method: '', note: '' })
    loadPayments(clinic.id)
  }

  const savePlatformOverride = async clinic => {
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

  const setClinicAccess = async (clinic, blocked) => {
    const subscription_status = blocked ? 'blocked' : 'active'
    setAccessSavingId(clinic.id)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_status }),
      })
      if (!r.ok) {
        toast.error('Failed to update access')
        return
      }
      toast.success(blocked ? `${clinic.name} access paused` : `${clinic.name} access restored (trial auto-block paused)`)
      await loadAll()
      const updated = await r.json().catch(() => ({}))
      if (manageClinic?.id === clinic.id) {
        setManageClinic(c => ({
          ...c,
          subscription_status,
          trial_auto_enforcement: updated.trial_auto_enforcement ?? (blocked ? 'auto' : 'paused'),
        }))
      }
    } catch {
      toast.error('Network error')
    } finally {
      setAccessSavingId(null)
    }
  }

  const resumeTrialAutoBlock = async () => {
    if (!manageClinic) return
    try {
      const r = await fetch(`/api/platform-admin/clinics/${manageClinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trial_auto_enforcement: 'auto' }),
      })
      if (!r.ok) {
        toast.error('Failed to update auto-enforcement')
        return
      }
      toast.success('Trial auto-block re-enabled for this clinic')
      await loadAll()
      const updated = await r.json()
      setManageClinic(c => ({ ...c, trial_auto_enforcement: updated.trial_auto_enforcement || 'auto' }))
    } catch {
      toast.error('Network error')
    }
  }

  const saveAiLimit = async () => {
    if (!manageClinic) return
    const raw = aiLimitDraft.trim()
    const monthly_ai_usage_limit = raw === '' ? null : Number(raw)
    if (raw !== '' && (!Number.isFinite(monthly_ai_usage_limit) || monthly_ai_usage_limit < 0)) {
      toast.error('Enter a valid non-negative number or leave empty')
      return
    }
    setAiLimitSaving(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${manageClinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_ai_usage_limit }),
      })
      if (!r.ok) {
        toast.error('Failed to save AI limit')
        return
      }
      toast.success('AI usage limit saved')
      await loadAll()
      const updated = await r.json()
      setManageClinic(c => ({ ...c, monthly_ai_usage_limit: updated.monthly_ai_usage_limit }))
    } catch {
      toast.error('Network error')
    } finally {
      setAiLimitSaving(false)
    }
  }

  const submitPayment = async e => {
    e.preventDefault()
    if (!manageClinic) return
    setPaymentSaving(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${manageClinic.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error || 'Failed to record payment')
        return
      }
      toast.success('Payment recorded')
      setPaymentForm(f => ({ ...f, amount: '', method: '', note: '' }))
      await loadPayments(manageClinic.id)
      await loadAll()
    } catch {
      toast.error('Network error')
    } finally {
      setPaymentSaving(false)
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
                    <th className="py-2 pr-4 font-medium">Razorpay status</th>
                    <th className="py-2 pr-4 font-medium">Access</th>
                    <th className="py-2 pr-4 font-medium">Manual override</th>
                    <th className="py-2 pr-4 font-medium">Last activity</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No clinics yet</td></tr>
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
                      <td className="py-3 pr-4 capitalize">{c.billing_status || '—'}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <AccessBadge status={c.subscription_status} />
                          <Switch
                            checked={c.subscription_status === 'blocked'}
                            disabled={accessSavingId === c.id}
                            onCheckedChange={checked => setClinicAccess(c, checked)}
                          />
                        </div>
                      </td>
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
                      <td className="py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => openManage(c)}>
                            Manage
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={savingId === c.id}
                            onClick={() => savePlatformOverride(c)}
                          >
                            {savingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
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
                        <AuditDetails log={log} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!manageClinic} onOpenChange={open => { if (!open) setManageClinic(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{manageClinic?.name}</DialogTitle>
          </DialogHeader>
          {manageClinic && (
            <>
            {manageClinic.trial_auto_enforcement === 'paused' && manageClinic.subscription_status !== 'blocked' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-sm space-y-2">
                <p className="text-amber-900 dark:text-amber-100">
                  Trial auto-block is paused after a manual unblock. The daily cron will not re-block this clinic until you re-enable auto-enforcement below.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={resumeTrialAutoBlock}>
                  Re-enable trial auto-block
                </Button>
              </div>
            )}
            <Tabs defaultValue="payments" className="mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="ai">AI limit</TabsTrigger>
              </TabsList>
              <TabsContent value="payments" className="space-y-4 mt-4">
                <form onSubmit={submitPayment} className="space-y-3 border rounded-lg p-4">
                  <p className="text-sm font-medium">Record manual payment</p>
                  <div className="grid gap-2">
                    <Label htmlFor="pay-date">Date</Label>
                    <Input
                      id="pay-date"
                      type="date"
                      required
                      value={paymentForm.date}
                      onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pay-amount">Amount (INR)</Label>
                    <Input
                      id="pay-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pay-method">Method</Label>
                    <Input
                      id="pay-method"
                      placeholder="UPI, bank transfer, …"
                      required
                      value={paymentForm.method}
                      onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pay-note">Note (optional)</Label>
                    <Input
                      id="pay-note"
                      value={paymentForm.note}
                      onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={paymentSaving}>
                    {paymentSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add payment'}
                  </Button>
                </form>
                <div>
                  <p className="text-sm font-medium mb-2">Payment history</p>
                  {paymentsLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments logged yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-1 pr-2">Date</th>
                          <th className="py-1 pr-2">Amount</th>
                          <th className="py-1 pr-2">Method</th>
                          <th className="py-1">Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id} className="border-b border-border/50">
                            <td className="py-2 pr-2">{fmtDate(p.date)}</td>
                            <td className="py-2 pr-2">{fmtMoney(p.amount)}</td>
                            <td className="py-2 pr-2">{p.method}</td>
                            <td className="py-2 text-muted-foreground text-xs">
                              {p.recorded_by_email || '—'} · {fmtDateTime(p.recorded_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="ai" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Stored for future enforcement only — does not block AI features today.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="ai-limit">Monthly AI usage limit</Label>
                  <Input
                    id="ai-limit"
                    type="number"
                    min="0"
                    placeholder="Leave empty for no limit set"
                    value={aiLimitDraft}
                    onChange={e => setAiLimitDraft(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={saveAiLimit} disabled={aiLimitSaving}>
                  {aiLimitSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save limit'}
                </Button>
              </TabsContent>
            </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
