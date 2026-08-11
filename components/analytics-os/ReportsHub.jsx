'use client'

import { useEffect, useState } from 'react'
import { Loader2, Download, FileText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const SECTIONS = [
  { id: 'business', label: 'Business', endpoint: '/api/reports/business' },
  { id: 'revenue', label: 'Revenue', endpoint: '/api/reports/revenue' },
  { id: 'financial', label: 'Financial', endpoint: '/api/reports/financial' },
  { id: 'patients', label: 'Patients', endpoint: '/api/reports/patients' },
  { id: 'appointments', label: 'Appointments', endpoint: '/api/reports/appointments' },
  { id: 'doctors', label: 'Doctors', endpoint: '/api/reports/doctors' },
  { id: 'treatments', label: 'Treatments', endpoint: '/api/reports/treatments' },
  { id: 'inventory', label: 'Inventory', endpoint: '/api/reports/inventory' },
  { id: 'lab', label: 'Lab', endpoint: '/api/reports/lab' },
  { id: 'activity', label: 'Activity', endpoint: '/api/reports/activity-summary' },
]

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

function ReportPreview({ section, data }) {
  if (!data) return null

  switch (section) {
    case 'business':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Health Score" value={`${data.health?.score}/100`} />
          <Metric label="Revenue" value={inr(data.revenue?.total_revenue)} />
          <Metric label="Growth" value={`${data.revenue?.growth_pct}%`} />
          <Metric label="Retention" value={`${data.patients?.retention_pct}%`} />
        </div>
      )
    case 'revenue':
    case 'financial':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total Revenue" value={inr(data.revenue?.total_revenue ?? data.financial?.revenue?.total_revenue)} />
          <Metric label="Collected" value={inr(data.revenue?.collected ?? data.financial?.revenue?.collected)} />
          <Metric label="Pending" value={inr(data.revenue?.pending_collections ?? data.financial?.revenue?.pending_collections)} />
          <Metric label="Efficiency" value={`${data.revenue?.collection_efficiency_pct ?? data.financial?.collection_efficiency_pct}%`} />
        </div>
      )
    case 'patients':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total" value={data.patients?.total_patients} />
          <Metric label="New" value={data.patients?.new_patients} />
          <Metric label="Inactive" value={data.patients?.inactive_patients} />
          <Metric label="Follow-ups Due" value={data.patients?.followups_due} />
        </div>
      )
    case 'doctors':
      return (
        <div className="space-y-2">
          {(data.doctors || []).slice(0, 5).map(d => (
            <div key={d.doctor_id} className="flex justify-between text-sm">
              <span>{d.name}</span>
              <span>{inr(d.revenue)} · {d.appointments} appts</span>
            </div>
          ))}
        </div>
      )
    case 'treatments':
      return (
        <div className="space-y-2">
          {(data.treatments?.top_treatments || []).slice(0, 5).map(t => (
            <div key={t.name} className="flex justify-between text-sm">
              <span>{t.name}</span>
              <span>{t.count} times</span>
            </div>
          ))}
        </div>
      )
    case 'inventory':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Value" value={inr(data.metrics?.total_value)} />
          <Metric label="Low Stock" value={data.metrics?.low_stock_count} />
          <Metric label="Health" value={`${data.metrics?.inventory_health_pct}%`} />
          <Metric label="Monthly Spend" value={inr(data.metrics?.monthly_spend)} />
        </div>
      )
    case 'lab':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Open Cases" value={data.metrics?.open_cases} />
          <Metric label="Delayed" value={`${data.metrics?.delay_percentage}%`} />
          <Metric label="Turnaround" value={data.metrics?.average_turnaround_days != null ? `${data.metrics.average_turnaround_days}d` : '—'} />
          <Metric label="Completed Week" value={data.metrics?.completed_this_week} />
        </div>
      )
    case 'appointments':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="No-show Rate" value={`${data.metrics?.no_show_rate_pct}%`} />
          <Metric label="Cancellation" value={`${data.metrics?.cancellation_rate_pct}%`} />
          <Metric label="Completion" value={`${data.metrics?.completion_rate_pct}%`} />
          <Metric label="Avg Wait" value={data.metrics?.average_wait_minutes != null ? `${data.metrics.average_wait_minutes}m` : '—'} />
        </div>
      )
    case 'activity':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total Events" value={data.total} />
          {Object.entries(data.by_module || {}).slice(0, 3).map(([mod, count]) => (
            <Metric key={mod} label={mod} value={count} />
          ))}
        </div>
      )
    default:
      return <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(data, null, 2).slice(0, 500)}</pre>
  }
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{value ?? '—'}</div>
    </div>
  )
}

export default function ReportsHub({ initialSection = 'business' }) {
  const [section, setSection] = useState(initialSection)
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const current = SECTIONS.find(s => s.id === section) || SECTIONS[0]

  useEffect(() => {
    setLoading(true)
    const sec = SECTIONS.find(s => s.id === section) || SECTIONS[0]
    fetch(`${sec.endpoint}?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [section, days])

  const exportCsv = () => {
    window.open(`${current.endpoint}?days=${days}&format=csv`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                section === s.id ? 'bg-[#0D9488] text-white border-[#0D9488]' : 'border-border hover:bg-muted'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[7, 30, 90, 365].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-2 py-1 rounded border ${days === d ? 'bg-muted font-medium' : 'border-border'}`}
            >
              {d}d
            </button>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportCsv}>
            <Download className="w-3 h-3 mr-1" />CSV
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <a href="/business"><FileText className="w-3 h-3 mr-1" />Executive</a>
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-6 min-h-[200px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">{current.label} Report</h2>
          {data?.pdf_ready && <span className="text-[10px] text-muted-foreground">PDF-ready structure</span>}
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
        ) : (
          <ReportPreview section={section} data={data} />
        )}
      </Card>
    </div>
  )
}
