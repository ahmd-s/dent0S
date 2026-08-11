'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import ActivityTimeline from '@/components/dentos/ActivityTimeline'

export function RecentActivityWidget() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/timeline/clinic?limit=8')
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="p-4 md:p-6 bg-card border-border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0D9488]" />
          <h3 className="font-semibold text-foreground">Recent Activity</h3>
        </div>
        <Link href="/settings/activity" className="text-xs text-[#0D9488] hover:underline">
          View all
        </Link>
      </div>
      <ActivityTimeline
        events={events}
        loading={loading}
        compact
        emptyMessage="No recent activity"
      />
    </Card>
  )
}
