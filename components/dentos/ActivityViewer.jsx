'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ActivityTimeline from './ActivityTimeline'
import {
  ALL_ACTIVITY_MODULES,
  ALL_ACTIVITY_EVENTS,
  MODULE_LABELS,
  EVENT_LABELS,
} from '@/lib/activity-event-registry'

export default function ActivityViewer({ title = 'Clinic Activity', limit = 50 }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState('')
  const [event, setEvent] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(page) })
      if (module) params.set('module', module)
      if (event) params.set('event', event)
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const r = await fetch(`/api/timeline/clinic?${params}`)
      const d = await r.json()
      if (r.ok) {
        setEvents(d.events || [])
        setPagination(d.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [limit, page, module, event, from, to])

  useEffect(() => {
    load()
  }, [load])

  const applyFilters = () => {
    setPage(1)
    load()
  }

  const clearFilters = () => {
    setModule('')
    setEvent('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  return (
    <Card className="p-4 md:p-6 bg-card border-border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={clearFilters}>Clear</Button>
          <Button size="sm" className="bg-[#0D9488] hover:bg-[#0B7E73]" onClick={applyFilters}>
            Apply filters
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="space-y-1">
          <Label className="text-xs">Module</Label>
          <Select value={module || 'all'} onValueChange={v => setModule(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All modules" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {ALL_ACTIVITY_MODULES.map(m => (
                <SelectItem key={m} value={m}>{MODULE_LABELS[m] || m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Event</Label>
          <Select value={event || 'all'} onValueChange={v => setEvent(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All events" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {ALL_ACTIVITY_EVENTS.map(e => (
                <SelectItem key={e} value={e}>{EVENT_LABELS[e] || e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" />
        </div>
      </div>

      <ActivityTimeline events={events} loading={loading} />

      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pagination.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.total_pages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </Card>
  )
}
