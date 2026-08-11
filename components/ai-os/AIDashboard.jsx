'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, FileText, Mic, Lightbulb, Clock, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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

export default function AIDashboard() {
  const [data, setData] = useState(null)
  const [automation, setAutomation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/ai/dashboard').then(r => r.json()),
      fetch('/api/ai/automation').then(r => r.json()),
    ]).then(([dash, auto]) => {
      setData(dash)
      setAutomation(auto)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="Today's Summaries" value={data?.todays_summaries} icon={Sparkles} color="#0D9488" />
        <Metric label="Pending Drafts" value={data?.pending_drafts} icon={FileText} color="#F59E0B" />
        <Metric label="Voice Notes" value={data?.voice_notes} icon={Mic} color="#6366F1" />
        <Metric label="Clinical Suggestions" value={data?.clinical_suggestions} icon={Lightbulb} color="#8B5CF6" />
        <Metric label="Requests Today" value={data?.requests_today} icon={Zap} color="#EC4899" />
        <Metric label="Automation Queue" value={data?.automation_queue_size} icon={Clock} color="#0D9488" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3">Recent AI Activity</h3>
          <div className="space-y-2">
            {(data?.recent_activity || []).slice(0, 8).map(r => (
              <div key={r.id} className="flex justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="capitalize truncate">{r.type?.replace(/_/g, ' ')}</span>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
            {!data?.recent_activity?.length && <p className="text-xs text-muted-foreground">No AI activity yet.</p>}
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3">Automation Queue</h3>
          <div className="space-y-2">
            {(automation?.queue || []).map(item => (
              <div key={item.id} className="flex justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span>{item.label}</span>
                <span className="text-xs text-green-600 capitalize">{item.status}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 italic">All outputs are suggestions — doctor has final control.</p>
        </Card>
      </div>
    </div>
  )
}
