'use client'

import { useMemo } from 'react'
import { Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { waitColorClass } from '@/lib/flow-waiting-timer'

export default function WaitingTimer({ stats, appointments = [] }) {
  const derived = useMemo(() => {
    if (stats?.average_wait_minutes != null) {
      return {
        current: stats.waiting_count || 0,
        average: stats.average_wait_minutes,
        longest: stats.longest_wait_minutes || 0,
        health: stats.queue_health || 'good',
      }
    }
    return { current: 0, average: 0, longest: 0, health: 'good' }
  }, [stats])

  const healthColor = {
    good: 'text-green-600',
    moderate: 'text-amber-600',
    critical: 'text-red-600',
  }[derived.health] || 'text-green-600'

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-[#0D9488]" />
        <h3 className="font-semibold text-sm">Waiting Timer</h3>
        <span className={`text-xs ml-auto font-medium capitalize ${healthColor}`}>{derived.health}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Waiting" value={derived.current} icon={Clock} />
        <Stat label="Avg Wait" value={`${derived.average}m`} icon={TrendingUp} color={derived.average > 30 ? 'amber' : 'green'} />
        <Stat label="Longest" value={`${derived.longest}m`} icon={AlertTriangle} color={derived.longest > 45 ? 'red' : derived.longest > 20 ? 'amber' : 'green'} />
      </div>
    </Card>
  )
}

function Stat({ label, value, icon: Icon, color = 'default' }) {
  const colorClass = color === 'red' ? waitColorClass('red') : color === 'amber' ? waitColorClass('amber') : color === 'green' ? waitColorClass('green') : 'bg-muted text-foreground'
  return (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1 ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
