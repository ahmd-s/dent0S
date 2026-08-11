'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { MODULE_LABELS } from '@/lib/activity-event-registry'
import ActivityViewer from '@/components/dentos/ActivityViewer'

export default function ReportsPage() {
  const [summary, setSummary] = useState(null)
  const [apptMetrics, setApptMetrics] = useState(null)

  useEffect(() => {
    fetch('/api/reports/activity-summary?days=30')
      .then(r => r.json())
      .then(setSummary)
      .catch(() => setSummary(null))
    fetch('/api/reports/appointments?days=30')
      .then(r => r.json())
      .then(setApptMetrics)
      .catch(() => setApptMetrics(null))
  }, [])

  const m = apptMetrics?.metrics

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#0D9488]" />
          Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Activity-based reporting powered by the Activity Engine.
        </p>
      </div>

      {m && (
        <Card className="p-4 md:p-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0D9488]" />
            Appointment analytics (last {apptMetrics.days} days)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'No Show Rate', value: `${m.no_show_rate_pct}%`, sub: `${m.no_show_count} no shows` },
              { label: 'Cancellation Rate', value: `${m.cancellation_rate_pct}%`, sub: 'Of bookings' },
              { label: 'Reschedule Rate', value: `${m.reschedule_rate_pct}%`, sub: 'Rescheduled' },
              { label: 'Completion Rate', value: `${m.completion_rate_pct}%`, sub: 'After check-in' },
              { label: 'Avg Wait', value: m.average_wait_minutes != null ? `${m.average_wait_minutes} min` : '—', sub: 'Check-in to called' },
              { label: 'Avg Duration', value: m.average_duration_minutes != null ? `${m.average_duration_minutes} min` : '—', sub: 'Completed visits' },
              { label: 'Peak Hour', value: m.peak_hour ? `${m.peak_hour.hour}:00` : '—', sub: m.peak_hour ? `${m.peak_hour.count} bookings` : '' },
              { label: 'Bookings', value: m.appointments_booked, sub: `${m.appointments_completed} completed` },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-2xl font-bold tabular-nums mt-1">{item.value}</div>
                {item.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {summary?.by_module && (
        <Card className="p-4 md:p-6">
          <h2 className="text-sm font-semibold mb-4">Events by module (last {summary.days} days)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(summary.by_module).map(([mod, count]) => (
              <div key={mod} className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{MODULE_LABELS[mod] || mod}</div>
                <div className="text-2xl font-bold tabular-nums mt-1">{count}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">{summary.total} total events</p>
        </Card>
      )}

      <ActivityViewer title="Recent clinic activity" limit={30} />
    </div>
  )
}
