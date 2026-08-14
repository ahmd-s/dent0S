'use client'

import { useEffect, useState } from 'react'
import { Loader2, Bell, Send, CheckCircle, XCircle, Clock, Cake, Star, CreditCard, FlaskConical } from 'lucide-react'
import { Card } from '@/components/ui/card'

function Metric({ label, value, icon: Icon, color }) {
  return (
    <Card className="p-4 bg-card border-border rounded-xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{value ?? '—'}</div>
        </div>
      </div>
    </Card>
  )
}

const TYPE_LABELS = {
  appointment_reminder: 'Appointment',
  followup_reminder: 'Follow-up',
  payment_reminder: 'Payment',
  lab_update: 'Lab',
  review_request: 'Review',
  birthday_wish: 'Birthday',
  campaign: 'Campaign',
  manual: 'Manual',
}

export default function CommunicationDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/communication/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  if (!data?.ok) return <p className="text-sm text-muted-foreground">Unable to load dashboard.</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Metric label="Today's Reminders" value={data.todays_reminders} icon={Bell} color="#6366F1" />
        <Metric label="Scheduled Today" value={data.scheduled_today} icon={Clock} color="#8B5CF6" />
        <Metric label="Delivered" value={data.delivered} icon={CheckCircle} color="#22C55E" />
        <Metric label="Failed" value={data.failed} icon={XCircle} color="#EF4444" />
        <Metric label="Pending" value={data.pending} icon={Send} color="#F59E0B" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Review Requests" value={data.review_requests} icon={Star} color="#F59E0B" />
        <Metric label="Birthdays" value={data.birthdays} icon={Cake} color="#EC4899" />
        <Metric label="Payment Reminders" value={data.payment_reminders} icon={CreditCard} color="#EF4444" />
        <Metric label="Lab Notifications" value={data.lab_notifications} icon={FlaskConical} color="#0D9488" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {(data.recent_activity || []).slice(0, 8).map(m => (
              <div key={m.id} className="flex justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="truncate">{m.patient_name || 'Patient'} · {TYPE_LABELS[m.type] || m.type}</span>
                <span className={`text-xs capitalize ${m.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}`}>{m.status}</span>
              </div>
            ))}
            {!data.recent_activity?.length && <p className="text-xs text-muted-foreground">No messages yet.</p>}
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3">Upcoming Scheduled</h3>
          <div className="space-y-2">
            {(data.upcoming_scheduled || []).slice(0, 8).map(m => (
              <div key={m.id} className="flex justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="truncate">{m.patient_name || 'Patient'} · {TYPE_LABELS[m.type] || m.type}</span>
                <span className="text-xs text-muted-foreground">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : '—'}</span>
              </div>
            ))}
            {!data.upcoming_scheduled?.length && <p className="text-xs text-muted-foreground">No scheduled messages.</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
