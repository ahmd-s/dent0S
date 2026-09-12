'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CreditCard,
  ExternalLink,
  IndianRupee,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/platform-admin/StatCard'
import { fmtDateTime, fmtMoney, EMPTY } from '@/components/platform-admin/format'

const STATUS_TONE = {
  captured: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  authorized: 'bg-amber-50 text-amber-800 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  authenticated: 'bg-blue-50 text-blue-700 border-blue-200',
  halted: 'bg-amber-50 text-amber-800 border-amber-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-slate-100 text-slate-700 border-slate-200',
}

function StatusPill({ value }) {
  if (!value) return <span className="text-muted-foreground">{EMPTY}</span>
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_TONE[value] || 'bg-muted text-muted-foreground border-border'}`}>
      {value}
    </span>
  )
}

export default function RazorpayConsolePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch('/api/platform-admin/razorpay')
      if (!r.ok) throw new Error()
      setData(await r.json())
    } catch {
      toast.error('Failed to load Razorpay account')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const kpis = data?.kpis || {}

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#072654] text-white">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Razorpay</h1>
            <p className="text-sm text-muted-foreground">
              Live snapshot of the Connec8 Razorpay account used by DentOS billing.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => load({ silent: true })} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <a href={data?.dashboard_url || 'https://dashboard.razorpay.com/app/payments'} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Razorpay dashboard
            </a>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge variant="outline" className="font-normal">
              {data?.configured ? `${data.mode === 'live' ? 'Live' : 'Test'} · ${data.key_id_masked}` : 'Not configured'}
            </Badge>
            <Badge variant="outline" className="font-normal">
              Webhook {data?.webhook_configured ? 'ready' : 'missing'}
            </Badge>
            {data?.error && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <ShieldAlert className="h-3.5 w-3.5" /> {data.error}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Captured this month" value={fmtMoney(kpis.captured_this_month)} icon={IndianRupee} tone="green" />
            <StatCard label="Captured payments" value={kpis.captured_count ?? 0} icon={CreditCard} tone="teal" />
            <StatCard label="Failed payments" value={kpis.failed_count ?? 0} icon={ShieldAlert} tone="red" />
            <StatCard label="Authorized" value={kpis.authorized_count ?? 0} icon={Wallet} tone="amber" />
            <StatCard label="Razorpay subscriptions" value={kpis.razorpay_subscriptions ?? 0} icon={CreditCard} tone="blue" />
            <StatCard label="Clinics linked" value={kpis.linked_clinics ?? 0} icon={Wallet} tone="violet" />
          </div>
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent payments</CardTitle>
            <CardDescription>Latest charges from the Razorpay account. Amounts are in INR.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (data?.payments || []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No payments returned from Razorpay.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-3 font-medium">Payment</th>
                      <th className="py-2 pr-3 font-medium">Amount</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Method</th>
                      <th className="py-2 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map(p => (
                      <tr key={p.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-mono text-[11px]">{p.id}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{fmtMoney((p.amount || 0) / 100)}</td>
                        <td className="py-2.5 pr-3"><StatusPill value={p.status} /></td>
                        <td className="py-2.5 pr-3 capitalize">{p.method || EMPTY}</td>
                        <td className="py-2.5 text-muted-foreground">{fmtDateTime(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Subscriptions</CardTitle>
            <CardDescription>Recurring plans currently on this Razorpay merchant.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (data?.subscriptions || []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No subscriptions returned from Razorpay.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-3 font-medium">Subscription</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Paid</th>
                      <th className="py-2 font-medium">Next charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptions.map(s => (
                      <tr key={s.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-mono text-[11px]">{s.id}</td>
                        <td className="py-2.5 pr-3"><StatusPill value={s.status} /></td>
                        <td className="py-2.5 pr-3 tabular-nums">{s.paid_count}/{s.total_count || '∞'}</td>
                        <td className="py-2.5 text-muted-foreground">{fmtDateTime(s.charge_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
