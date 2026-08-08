'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Ban,
  Bot,
  Building2,
  Calendar,
  CircleCheck,
  Clock,
  CreditCard,
  Database,
  FileText,
  Gift,
  IndianRupee,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  Server,
  Stethoscope,
  Timer,
  TriangleAlert,
  Users,
  Webhook,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AuditTimeline } from '@/components/platform-admin/AuditTimeline'
import { ClinicsTable } from '@/components/platform-admin/ClinicsTable'
import { StatCard } from '@/components/platform-admin/StatCard'
import { UsageHealthTable } from '@/components/platform-admin/UsageHealthTable'
import { toast } from 'sonner'

function InfraItem({ label, icon: Icon, healthy, value, detail }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${healthy ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-muted-foreground">{value}</span>}
        <span className={`h-2 w-2 rounded-full ${healthy ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
    </div>
  )
}

export default function PlatformAdminPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [clinics, setClinics] = useState([])
  const [inactive, setInactive] = useState([])
  const [cutoffDate, setCutoffDate] = useState(null)
  const [logs, setLogs] = useState([])

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const [metricsRes, clinicsRes, healthRes, auditRes] = await Promise.all([
        fetch('/api/platform-admin/metrics'),
        fetch('/api/platform-admin/clinics'),
        fetch('/api/platform-admin/health'),
        fetch('/api/platform-admin/audit-log?limit=100'),
      ])
      if (!metricsRes.ok || !clinicsRes.ok || !healthRes.ok || !auditRes.ok) {
        toast.error('Failed to load platform admin data')
        return
      }
      const [metricsData, clinicsData, healthData, auditData] = await Promise.all([
        metricsRes.json(),
        clinicsRes.json(),
        healthRes.json(),
        auditRes.json(),
      ])
      setMetrics(metricsData)
      setClinics(clinicsData.clinics || [])
      setInactive(healthData.inactive_clinics || [])
      setCutoffDate(healthData.cutoff_date || null)
      setLogs(auditData.logs || [])
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const lastCronAgo = useMemo(() => {
    if (!metrics?.infrastructure?.last_cron_run) return null
    const diff = Date.now() - new Date(metrics.infrastructure.last_cron_run).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return `${Math.floor(diff / 60000)}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }, [metrics])

  const fmtCurrency = v => `₹${(v || 0).toLocaleString('en-IN')}`

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[102px] rounded-xl" />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[102px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    )
  }

  const p = metrics?.platform || {}
  const u = metrics?.usage || {}
  const r = metrics?.revenue || {}
  const infra = metrics?.infrastructure || {}

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Live platform metrics — no patient or clinical data is surfaced here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadAll({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Platform section */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Clinics" value={p.total} icon={Building2} tone="teal" />
          <StatCard label="Active" value={p.active} hint="Access open" icon={CircleCheck} tone="green" />
          <StatCard label="Trial" value={p.trial} hint="Billing: trial" icon={Timer} tone="blue" />
          <StatCard label="Grace" value={p.grace} hint="Payment halted" icon={TriangleAlert} tone="amber" />
          <StatCard label="Blocked" value={p.blocked} hint="Access paused" icon={Ban} tone="red" />
          <StatCard label="Comped" value={p.comped} hint="Platform override" icon={Gift} tone="violet" />
        </div>
      </div>

      {/* Usage section */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usage</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Doctors" value={u.doctors} icon={Stethoscope} tone="teal" />
          <StatCard label="Receptionists" value={u.receptionists} icon={Users} tone="slate" />
          <StatCard label="Patients" value={u.patients} icon={Users} tone="blue" />
          <StatCard label="Visits Today" value={u.visits_today} icon={Activity} tone="green" />
          <StatCard label="Appts Today" value={u.appointments_today} icon={Calendar} tone="teal" />
          <StatCard label="AI Requests" value={u.ai_requests_today} hint="Today" icon={Bot} tone="violet" />
          <StatCard label="Documents" value={u.documents_stored} icon={FileText} tone="slate" />
          <StatCard label="Admins" value={u.admins} icon={Users} tone="slate" />
        </div>
      </div>

      {/* Revenue section */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Monthly Revenue" value={fmtCurrency(r.monthly_manual_revenue)} icon={IndianRupee} tone="green" />
          <StatCard label="Active Plans" value={r.active_subscriptions} icon={CreditCard} tone="teal" />
          <StatCard label="Failed Payments" value={r.failed_payments} hint="Halted billing" icon={Ban} tone="red" />
          <StatCard label="Expiring Trials" value={r.expiring_trials} hint="≤7 days" icon={Timer} tone="amber" />
          <StatCard label="Expiring Grace" value={r.expiring_grace} hint="≤7 days" icon={TriangleAlert} tone="orange" />
        </div>
      </div>

      {/* Infrastructure section */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Infrastructure</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Services</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-4">
              <InfraItem
                label="MongoDB"
                icon={Database}
                healthy={infra.mongo_healthy}
                value={infra.mongo_latency_ms != null ? `${infra.mongo_latency_ms}ms` : undefined}
                detail={infra.mongo_healthy ? 'Connected' : 'Disconnected'}
              />
              <InfraItem
                label="Email Service"
                icon={Mail}
                healthy={infra.email_configured}
                detail={infra.email_configured ? 'Configured' : 'Not configured'}
              />
              <InfraItem
                label="WhatsApp"
                icon={MessageSquare}
                healthy={infra.whatsapp_configured}
                detail={infra.whatsapp_configured ? 'Configured' : 'Not configured'}
              />
              <InfraItem
                label="Razorpay"
                icon={Webhook}
                healthy={infra.razorpay_configured}
                detail={infra.razorpay_configured ? 'Configured' : 'Not configured'}
              />
              <InfraItem
                label="Cron"
                icon={Zap}
                healthy={!!infra.last_cron_run}
                value={lastCronAgo || undefined}
                detail={infra.last_cron_run ? 'Trial/grace expiry job' : 'Never recorded'}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">System</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-4">
              <InfraItem
                label="Server"
                icon={Server}
                healthy
                detail={`${infra.environment} environment`}
              />
              <InfraItem
                label="Server Time"
                icon={Clock}
                healthy
                value={infra.server_time ? new Date(infra.server_time).toLocaleTimeString() : undefined}
                detail={infra.server_time ? new Date(infra.server_time).toLocaleDateString() : ''}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="clinics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="clinics">Clinics</TabsTrigger>
          <TabsTrigger value="health">Usage Health</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="clinics" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Clinics Directory</CardTitle>
              <CardDescription>Select a clinic to open its control center.</CardDescription>
            </CardHeader>
            <CardContent>
              <ClinicsTable clinics={clinics} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Inactive 14+ Days</CardTitle>
              <CardDescription>Clinics with no visits recorded in the last 14 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <UsageHealthTable clinics={inactive} cutoffDate={cutoffDate} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Platform admin actions, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTimeline logs={logs} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
