'use client'

import { useEffect, useState } from 'react'
import { Loader2, Star, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ReviewPanel() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/communication?action=reviews')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Track review requests and responses. Google integration ready.</p>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3 h-3 mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Requested', value: stats?.requested, color: '#6366F1' },
          { label: 'Received', value: stats?.received, color: '#22C55E' },
          { label: 'Pending', value: stats?.pending, color: '#F59E0B' },
          { label: 'Ignored', value: stats?.ignored, color: '#94A3B8' },
          { label: 'Avg Rating', value: stats?.average_rating ?? '—', color: '#EC4899' },
        ].map(m => (
          <Card key={m.label} className="p-4 border-border text-center">
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="text-2xl font-bold mt-1 tabular-nums flex items-center justify-center gap-1" style={{ color: m.color }}>
              {m.label === 'Avg Rating' && stats?.average_rating && <Star className="w-4 h-4 fill-current" />}
              {m.value ?? '—'}
            </div>
          </Card>
        ))}
      </div>

      {stats?.google_integration_ready && (
        <Card className="p-4 border-border border-dashed">
          <p className="text-xs text-muted-foreground">Google Reviews integration placeholder — connect via Settings when available.</p>
        </Card>
      )}
    </div>
  )
}
