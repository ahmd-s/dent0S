'use client'

import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addDays, todayIso } from '@/lib/appointment-time'

const VIEWS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'doctor', label: 'Doctor' },
  { id: 'chair', label: 'Chair' },
  { id: 'queue', label: 'Queue' },
]

export default function CalendarToolbar({
  date,
  setDate,
  view,
  setView,
  searchQuery,
  setSearchQuery,
  onNewAppointment,
  onWalkIn,
  summary,
}) {
  const fmtFull = d => {
    const x = new Date(d + 'T00:00:00')
    return x.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="icon" variant="outline" onClick={() => setDate(addDays(date, view === 'week' ? -7 : view === 'month' ? -30 : -1))} className="h-9 w-9">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border border-input rounded-md text-sm h-9" />
          <Button size="icon" variant="outline" onClick={() => setDate(addDays(date, view === 'week' ? 7 : view === 'month' ? 30 : 1))} className="h-9 w-9">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDate(todayIso())} className="text-[#0D9488] h-9">Today</Button>
          <span className="text-sm text-muted-foreground hidden sm:inline">{fmtFull(date)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-initial lg:w-48">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search patient…" className="pl-8 h-9 text-sm" />
          </div>
          {onWalkIn && (
            <Button variant="outline" onClick={onWalkIn} className="h-9">Walk-In</Button>
          )}
          <Button onClick={onNewAppointment} className="bg-[#0D9488] hover:bg-[#0B7E73] h-9">New Appointment</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-muted border border-border rounded-md p-0.5 flex-wrap">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-2.5 py-1.5 text-xs rounded transition-colors ${view === v.id ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {summary && (
          <div className="text-xs text-muted-foreground ml-auto">
            {summary.scheduled} scheduled · {summary.waiting} waiting · {summary.completed} completed · {summary.cancelled} cancelled
          </div>
        )}
      </div>
    </div>
  )
}

export { VIEWS }
