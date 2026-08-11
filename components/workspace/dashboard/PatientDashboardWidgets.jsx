'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, AlertTriangle, Stethoscope, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getRecentPatients } from '@/lib/patient-clinical'

const fmtDate = d => {
  if (!d) return '—'
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}

export function RecentPatientsWidget() {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    setRecent(getRecentPatients())
    const onFocus = () => setRecent(getRecentPatients())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <Card className="p-4 md:p-5 bg-card border-border rounded-xl h-full">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-[#0D9488]" />
        <h3 className="font-semibold text-sm">Recently Viewed</h3>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Open a patient to see recent history</p>
      ) : (
        <div className="space-y-2">
          {recent.map(p => (
            <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-sm">
              <span className="font-medium truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">{fmtDate(p.viewed_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

export function ActiveTreatmentsWidget() {
  const [items, setItems] = useState([])

  useEffect(() => {
    fetch('/api/patients/dashboard').then(r => r.json()).then(d => setItems(d.active_treatments || []))
  }, [])

  return (
    <Card className="p-4 md:p-5 bg-card border-border rounded-xl h-full">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-4 h-4 text-[#0D9488]" />
        <h3 className="font-semibold text-sm">Active Treatments Today</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No active visits today</p>
      ) : (
        <div className="space-y-2">
          {items.map(v => (
            <Link key={v.visit_id} href={`/visits/${v.visit_id}`} className="block p-2 rounded-lg hover:bg-muted">
              <div className="font-medium text-sm">{v.patient_name}</div>
              <div className="text-xs text-muted-foreground truncate">{v.chief_complaint || 'In consultation'}</div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

export function CriticalPatientsWidget() {
  const [items, setItems] = useState([])

  useEffect(() => {
    fetch('/api/patients/dashboard').then(r => r.json()).then(d => setItems(d.critical_patients || []))
  }, [])

  return (
    <Card className="p-4 md:p-5 bg-card border-border rounded-xl h-full">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h3 className="font-semibold text-sm">Critical Patients</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No critical flags</p>
      ) : (
        <div className="space-y-2">
          {items.map(p => (
            <Link key={p.id} href={`/patients/${p.id}`} className="block p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-100">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{p.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 shrink-0">{p.reason}</span>
              </div>
              {p.detail && <div className="text-xs text-muted-foreground truncate mt-0.5">{p.detail}</div>}
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

export function TodaysFollowupsWidget({ stats }) {
  const [items, setItems] = useState(stats?.followups || [])

  useEffect(() => {
    if (stats?.followups) setItems(stats.followups)
    else fetch('/api/patients/dashboard').then(r => r.json()).then(d => setItems(d.followups_today || []))
  }, [stats])

  return (
    <Card className="p-4 md:p-5 bg-card border-border rounded-xl h-full">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-orange-500" />
        <h3 className="font-semibold text-sm">Today&apos;s Follow-ups</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No follow-ups due today</p>
      ) : (
        <div className="space-y-2">
          {items.map(p => (
            <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-sm">
              <span className="font-medium truncate">{p.name}</span>
              <span className="text-xs text-orange-600 shrink-0">{fmtDate(p.next_followup_date)}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
