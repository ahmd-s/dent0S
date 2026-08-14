'use client'

import { Suspense, useState, useEffect } from 'react'
import { Loader2, LayoutGrid, Zap, Users } from 'lucide-react'
import AIDashboard from './AIDashboard'

function RecallPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ai/automation?action=recall')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>

  const labels = {
    recall_needed: 'Needs Recall',
    followup_likely: 'Likely Follow-up',
    inactive: 'Inactive Patients',
    high_risk: 'High Risk',
    review_needed: 'Review Needed',
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(data?.counts || {}).map(([key, count]) => (
        <div key={key} className="p-4 rounded-xl border border-border bg-card">
          <div className="text-xs text-muted-foreground">{labels[key] || key}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{count}</div>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [view, setView] = useState('dashboard')
  const views = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'recall', label: 'Recall Intelligence', icon: Users },
    { id: 'automation', label: 'Automation', icon: Zap },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">AI Clinical Assistant</h1>
          <p className="text-muted-foreground text-sm">Suggest · Draft · Recommend · Explain — never autonomous</p>
        </div>
        <div className="flex bg-muted border border-border rounded-md p-0.5">
          {views.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className={`px-2.5 py-1.5 text-xs rounded flex items-center gap-1 ${view === v.id ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>
              <v.icon className="w-3 h-3" />{v.label}
            </button>
          ))}
        </div>
      </div>
      {view === 'dashboard' && <AIDashboard />}
      {view === 'recall' && <RecallPanel />}
      {view === 'automation' && <AIDashboard />}
    </div>
  )
}

export default function AIHub() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>}>
      <App />
    </Suspense>
  )
}
