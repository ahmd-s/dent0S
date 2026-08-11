'use client'

import { Suspense, useState, useEffect } from 'react'
import { Loader2, LayoutGrid, Megaphone, Bell, Star, MessageSquare, Users } from 'lucide-react'
import CommunicationDashboard from './CommunicationDashboard'
import CampaignCenter from './CampaignCenter'
import ReminderCenter from './ReminderCenter'
import ReviewPanel from './ReviewPanel'
import CommunicationTimeline from './CommunicationTimeline'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'reminders', label: 'Reminders', icon: Bell },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'timeline', label: 'Timeline', icon: MessageSquare },
  { id: 'segments', label: 'Segments', icon: Users },
]

function SegmentsPanel() {
  const [segments, setSegments] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/communication?action=segments')
      .then(r => r.json())
      .then(d => { setSegments(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>

  const labels = {
    new_patients: 'New Patients',
    vip_patients: 'VIP Patients',
    inactive_patients: 'Inactive Patients',
    pending_treatment: 'Pending Treatment',
    followup_due: 'Follow-up Due',
    outstanding_balance: 'Outstanding Balance',
    high_value: 'High Value',
    frequent_visitors: 'Frequent Visitors',
    lab_pending: 'Lab Pending',
    review_pending: 'Review Pending',
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(segments?.counts || {}).map(([key, count]) => (
        <div key={key} className="p-4 rounded-xl border border-border bg-card">
          <div className="text-xs text-muted-foreground">{labels[key] || key}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{count}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Calculated dynamically</div>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [view, setView] = useState('dashboard')

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Communication OS</h1>
          <p className="text-muted-foreground text-sm">Patient engagement, reminders, campaigns &amp; reviews</p>
        </div>
        <div className="flex bg-muted border border-border rounded-md p-0.5 flex-wrap">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-2.5 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${view === v.id ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <v.icon className="w-3 h-3" />{v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'dashboard' && <CommunicationDashboard />}
      {view === 'campaigns' && <CampaignCenter />}
      {view === 'reminders' && <ReminderCenter />}
      {view === 'reviews' && <ReviewPanel />}
      {view === 'timeline' && <CommunicationTimeline />}
      {view === 'segments' && <SegmentsPanel />}
    </div>
  )
}

export default function CommunicationHub() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>}>
      <App />
    </Suspense>
  )
}
