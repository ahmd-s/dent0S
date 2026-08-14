'use client'

import { memo, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import ActivityTimeline from '@/components/dentos/ActivityTimeline'
import { DASHBOARD_PANEL_CLASS, DASHBOARD_PANEL_TITLE_CLASS } from './dashboard-panel-styles'

export const RecentActivityWidget = memo(function RecentActivityWidget({ className }) {
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
    <Card className={cn(DASHBOARD_PANEL_CLASS, className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0D9488]" />
          <h3 className={DASHBOARD_PANEL_TITLE_CLASS}>Recent Activity</h3>
        </div>
        <Link href="/settings/activity" className="text-xs text-[#0D9488] hover:underline">
          View all
        </Link>
      </div>
      <div className="flex-1 min-h-0">
        <ActivityTimeline
          events={events}
          loading={loading}
          compact
          emptyMessage="No recent activity"
        />
      </div>
    </Card>
  )
})
