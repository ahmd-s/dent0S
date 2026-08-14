'use client'
import { memo, useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { BarChart3, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PERIODS = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '12m', label: 'Last 12 Months' },
]

const fmtCurrency = v => (v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`)

const AnalyticsChart = dynamic(() => import('@/components/platform-admin/AnalyticsChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-md" />,
})

const ChartCard = memo(function ChartCard({ title, description, data, dataKey = 'value', color = '#0D9488', type = 'bar', formatY }) {
  const isEmpty = !data || data.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {isEmpty ? (
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data for this period</p>
        </CardContent>
      ) : (
        <CardContent>
          <AnalyticsChart data={data} dataKey={dataKey} color={color} type={type} formatY={formatY} />
        </CardContent>
      )}
    </Card>
  )
})

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('12m')

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/analytics?period=${period}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setData(d)
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Business Analytics</h1>
            <p className="text-sm text-muted-foreground">All data sourced directly from MongoDB. No estimates.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={p => { setPeriod(p) }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load({ silent: true })}
            disabled={refreshing}
            aria-label={refreshing ? 'Refreshing analytics' : 'Refresh analytics'}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          </Button>
        </div>
      </div>

      {/* Totals row */}
      {data?.totals && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Clinics', value: data.totals.clinics },
            { label: 'Total Patients', value: data.totals.patients },
            { label: 'Total Documents', value: data.totals.documents },
          ].map(t => (
            <Card key={t.label}>
              <CardContent className="pt-5">
                <p className="text-3xl font-bold text-foreground">{t.value?.toLocaleString('en-IN')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Clinic Signups"
          description="New clinics registered per period"
          data={data?.clinicGrowth}
          color="#0D9488"
          type="bar"
        />
        <ChartCard
          title="Manual Revenue"
          description="Revenue from manual payments (INR)"
          data={data?.revenue}
          color="#10b981"
          type="bar"
          formatY={fmtCurrency}
        />
        <ChartCard
          title="Payment Recoveries"
          description="Successful payment recoveries per period"
          data={data?.trialConversions}
          color="#6366f1"
          type="area"
        />
        <ChartCard
          title="Patient Registrations"
          description="New patients added per period"
          data={data?.patients}
          color="#f59e0b"
          type="area"
        />
        <ChartCard
          title="Document Uploads"
          description="Documents uploaded per period"
          data={data?.documents}
          color="#8b5cf6"
          type="bar"
        />
      </div>
    </div>
  )
}
