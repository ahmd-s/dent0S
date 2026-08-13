'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, AlertTriangle, Stethoscope, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { getRecentPatients } from '@/lib/patient-clinical'
import { cn } from '@/lib/utils'
import { DASHBOARD_PANEL_CLASS, DASHBOARD_PANEL_TITLE_CLASS } from './dashboard-panel-styles'

const fmtDate = d => {
  if (!d) return '—'
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}

/** Deduplicate concurrent /api/patients/dashboard fetches from sibling widgets. */
let patientsDashboardInflight = null
let patientsDashboardCache = null
let patientsDashboardCacheAt = 0
const PATIENTS_DASH_TTL_MS = 15_000

function fetchPatientsDashboard() {
  const now = Date.now()
  if (patientsDashboardCache && now - patientsDashboardCacheAt < PATIENTS_DASH_TTL_MS) {
    return Promise.resolve(patientsDashboardCache)
  }
  if (patientsDashboardInflight) return patientsDashboardInflight
  patientsDashboardInflight = fetch('/api/patients/dashboard')
    .then(r => r.json())
    .then(d => {
      patientsDashboardCache = d
      patientsDashboardCacheAt = Date.now()
      patientsDashboardInflight = null
      return d
    })
    .catch(err => {
      patientsDashboardInflight = null
      throw err
    })
  return patientsDashboardInflight
}

export function RecentPatientsWidget({ className }) {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    setRecent(getRecentPatients())
    const onFocus = () => setRecent(getRecentPatients())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <Card className={cn(DASHBOARD_PANEL_CLASS, className)}>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-[#0D9488]" />
        <h3 className={DASHBOARD_PANEL_TITLE_CLASS}>Recently Viewed</h3>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground flex-1 flex items-center justify-center text-center">Open a patient to see recent history</p>
      ) : (
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchPatientsDashboard()
      .then(d => { if (!cancelled) setItems(d.active_treatments || []) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="p-4 md:p-5 bg-card border-border rounded-xl h-full">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-4 h-4 text-[#0D9488]" />
        <h3 className="font-semibold text-sm">Active Treatments Today</h3>
      </div>
      {loading ? (
        <div className="h-16 animate-pulse bg-muted rounded-lg" />
      ) : items.length === 0 ? (
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchPatientsDashboard()
      .then(d => { if (!cancelled) setItems(d.critical_patients || []) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="p-4 md:p-5 bg-card border-border rounded-xl h-full">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h3 className="font-semibold text-sm">Critical Patients</h3>
      </div>
      {loading ? (
        <div className="h-16 animate-pulse bg-muted rounded-lg" />
      ) : items.length === 0 ? (
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
    if (stats?.followups) {
      setItems(stats.followups)
      return
    }
    let cancelled = false
    fetchPatientsDashboard()
      .then(d => { if (!cancelled) setItems(d.followups_today || []) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
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
