'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import AppointmentCard from './AppointmentCard'
import { parseTimeToMinutes, minutesToTimeLabel, timeSlots, weekDates, monthGrid } from '@/lib/appointment-time'

const SLOT_HEIGHT = 28
const START_MIN = 8 * 60
const END_MIN = 20 * 60

function filterSearch(list, q) {
  if (!q?.trim()) return list
  const s = q.toLowerCase()
  return list.filter(a =>
    (a.patient_name || a.patient_name_temp || '').toLowerCase().includes(s) ||
    (a.doctor_name || '').toLowerCase().includes(s) ||
    (a.chair_name || '').toLowerCase().includes(s)
  )
}

function apptStyle(a) {
  const start = parseTimeToMinutes(a.appointment_time)
  if (start == null) return {}
  const top = ((start - START_MIN) / 15) * SLOT_HEIGHT
  const height = Math.max(((a.duration_minutes || 30) / 15) * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2)
  return { top: `${top}px`, height: `${height}px`, minHeight: `${SLOT_HEIGHT - 2}px` }
}

export default function AppointmentCalendar({
  view,
  date,
  appointments,
  doctors = [],
  chairs = [],
  searchQuery,
  onDropAppointment,
  onSelectAppointment,
  onBalanceClick,
  dragAppointmentId,
  setDragAppointmentId,
}) {
  const filtered = filterSearch(appointments, searchQuery)
  const slots = timeSlots(START_MIN, END_MIN, 15)

  const handleDrop = (e, targetDate, targetMinutes, targetDoctor, targetChair) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('appointmentId') || dragAppointmentId
    if (!id || !onDropAppointment) return
    onDropAppointment(id, {
      appointment_date: targetDate,
      appointment_time: minutesToTimeLabel(targetMinutes),
      doctor_id: targetDoctor,
      chair_id: targetChair,
    })
    setDragAppointmentId?.(null)
  }

  if (view === 'month') {
    const grid = monthGrid(date)
    const byDate = {}
    for (const a of filtered) {
      (byDate[a.appointment_date] = byDate[a.appointment_date] || []).push(a)
    }
    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="bg-muted text-xs font-medium text-center py-2 text-muted-foreground">{d}</div>
        ))}
        {grid.map(({ date: d, outside }) => (
          <div key={d} className={`bg-card min-h-[90px] p-1.5 ${outside ? 'opacity-50' : ''}`}>
            <div className="text-xs font-medium mb-1">{parseInt(d.slice(8), 10)}</div>
            <div className="space-y-0.5">
              {(byDate[d] || []).slice(0, 3).map(a => (
                <div key={a.id} className="text-[10px] truncate px-1 py-0.5 rounded bg-[#0D9488]/10 text-[#0D9488] cursor-pointer" onClick={() => onSelectAppointment?.(a)}>
                  {a.appointment_time?.slice(0, 8)} {a.patient_name || a.patient_name_temp}
                </div>
              ))}
              {(byDate[d]?.length || 0) > 3 && <div className="text-[10px] text-muted-foreground">+{byDate[d].length - 3} more</div>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (view === 'week') {
    const days = weekDates(date)
    const byDate = {}
    for (const a of filtered) (byDate[a.appointment_date] = byDate[a.appointment_date] || []).push(a)
    return (
      <div className="overflow-x-auto">
        <div className="grid grid-cols-8 min-w-[800px] gap-px bg-border rounded-lg border border-border overflow-hidden">
          <div className="bg-muted" />
          {days.map(d => (
            <div key={d} className="bg-muted text-xs font-medium text-center py-2">
              {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
            </div>
          ))}
          <div className="bg-muted text-[10px] text-muted-foreground">
            {slots.filter((_, i) => i % 4 === 0).map(t => (
              <div key={t} style={{ height: SLOT_HEIGHT * 4 }} className="pr-1 text-right pt-0.5">{minutesToTimeLabel(t)}</div>
            ))}
          </div>
          {days.map(d => (
            <div key={d} className="bg-card relative" style={{ height: slots.length * SLOT_HEIGHT }}>
              {slots.map(t => (
                <div
                  key={t}
                  className="absolute left-0 right-0 border-b border-border/50 hover:bg-[#0D9488]/5"
                  style={{ top: ((t - START_MIN) / 15) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, d, t)}
                />
              ))}
              {(byDate[d] || []).map(a => (
                <div key={a.id} className="absolute left-0.5 right-0.5 z-10" style={apptStyle(a)}>
                  <AppointmentCard
                    appointment={a}
                    compact
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('appointmentId', a.id); setDragAppointmentId?.(a.id) }}
                    onClick={() => onSelectAppointment?.(a)}
                    onBalanceClick={onBalanceClick}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (view === 'doctor') {
    const docList = doctors.length ? doctors : [...new Set(filtered.map(a => a.doctor_id))].map(id => ({
      id,
      full_name: filtered.find(a => a.doctor_id === id)?.doctor_name || 'Unassigned',
    }))
    return (
      <div className="space-y-4">
        {docList.map(doc => {
          const items = filtered.filter(a => a.doctor_id === doc.id)
          return (
            <Card key={doc.id} className="p-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <div className="w-8 h-8 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-semibold text-[#0D9488]">
                  {doc.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-sm">{doc.full_name}</div>
                  <div className="text-xs text-muted-foreground">{items.length} appointments</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map(a => (
                  <AppointmentCard key={a.id} appointment={a} draggable onDragStart={e => { e.dataTransfer.setData('appointmentId', a.id); setDragAppointmentId?.(a.id) }} onClick={() => onSelectAppointment?.(a)} onBalanceClick={onBalanceClick} />
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    )
  }

  if (view === 'chair') {
    const chairList = chairs.length ? chairs : []
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chairList.map(ch => {
          const items = filtered.filter(a => a.chair_id === ch.id)
          const utilPct = Math.min(Math.round((ch.utilization_minutes || 0) / (12 * 60) * 100), 100)
          return (
            <Card key={ch.id} className="p-4" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, date, START_MIN, null, ch.id)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ch.color || '#0D9488' }} />
                  <span className="font-medium">{ch.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{utilPct}% util</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-[#0D9488] rounded-full transition-all" style={{ width: `${utilPct}%` }} />
              </div>
              <div className="space-y-2 min-h-[80px]">
                {items.map(a => (
                  <AppointmentCard key={a.id} appointment={a} compact draggable onDragStart={e => { e.dataTransfer.setData('appointmentId', a.id); setDragAppointmentId?.(a.id) }} onClick={() => onSelectAppointment?.(a)} />
                ))}
                {!items.length && <p className="text-xs text-muted-foreground text-center py-4">Drop appointment here</p>}
              </div>
            </Card>
          )
        })}
      </div>
    )
  }

  // Day view (default)
  const dayAppts = filtered.filter(a => a.appointment_date === date)
  return (
    <div className="flex gap-0 rounded-lg border border-border overflow-hidden bg-card">
      <div className="w-16 flex-shrink-0 bg-muted border-r border-border">
        {slots.filter((_, i) => i % 2 === 0).map(t => (
          <div key={t} style={{ height: SLOT_HEIGHT * 2 }} className="text-[10px] text-muted-foreground text-right pr-2 pt-1 border-b border-border/50">
            {minutesToTimeLabel(t)}
          </div>
        ))}
      </div>
      <div className="flex-1 relative" style={{ height: slots.length * SLOT_HEIGHT }}>
        {slots.map(t => (
          <div
            key={t}
            className="absolute left-0 right-0 border-b border-border/40 hover:bg-[#0D9488]/5 transition-colors"
            style={{ top: ((t - START_MIN) / 15) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, date, t)}
          />
        ))}
        {dayAppts.map(a => (
          <div key={a.id} className="absolute left-1 right-1 z-10" style={apptStyle(a)}>
            <AppointmentCard
              appointment={a}
              draggable
              onDragStart={e => { e.dataTransfer.setData('appointmentId', a.id); setDragAppointmentId?.(a.id) }}
              onClick={() => onSelectAppointment?.(a)}
              onBalanceClick={onBalanceClick}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
