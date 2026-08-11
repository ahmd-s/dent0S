'use client'

import Link from 'next/link'
import { Phone, Edit2, AlertTriangle, Calendar, IndianRupee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import BalanceBadge from '@/components/dentos/BalanceBadge'
import WorkspaceGate from '@/components/workspace/WorkspaceGate'
import {
  fmtPatientDate,
  buildStatusChips,
  getUpcomingAppointment,
  CHIP_COLORS,
} from '@/lib/patient-clinical'

function PatientAvatar({ patient }) {
  const initials = patient?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  if (patient?.photo_url) {
    return <img src={patient.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
  }
  return (
    <div className="w-16 h-16 rounded-full bg-[#0D9488]/10 border-2 border-[#0D9488]/20 flex items-center justify-center text-xl font-bold text-[#0D9488]">
      {initials}
    </div>
  )
}

export default function PatientOverviewHeader({
  patient,
  appointments = [],
  clinical,
  balance = 0,
  onEdit,
  onBalanceClick,
  canEditProfile,
}) {
  const upcoming = getUpcomingAppointment(appointments)
  const chips = buildStatusChips(patient, appointments, balance)

  return (
    <Card className="p-4 md:p-6 bg-card border-border rounded-xl">
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <PatientAvatar patient={patient} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{patient.name}</h1>
              <div className="text-xs text-muted-foreground mt-0.5">{patient.patient_code}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <WorkspaceGate section="patient_page" flag="billing">
                <BalanceBadge patientId={patient.id} onClick={onBalanceClick} />
              </WorkspaceGate>
              {canEditProfile && (
                <button type="button" onClick={onEdit} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Edit">
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <a href={`tel:+91${patient.phone}`} className="flex items-center gap-1 text-[#0D9488] hover:underline">
              <Phone className="w-3.5 h-3.5" />+91 {patient.phone}
            </a>
            {patient.age != null && <span>{patient.age} yrs</span>}
            {patient.gender && <span className="capitalize">{patient.gender}</span>}
            {patient.blood_group && (
              <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs font-medium">{patient.blood_group}</span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Visit</div>
              <div className="font-medium">{fmtPatientDate(clinical?.latest_visit_date || patient.last_visit_date)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Visits</div>
              <div className="font-medium">{patient.total_visits || 0}</div>
            </div>
            <WorkspaceGate section="patient_page" flag="billing">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><IndianRupee className="w-3 h-3" />Balance</div>
                <div className={`font-medium ${balance > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                  {balance > 0 ? `₹${balance.toLocaleString('en-IN')}` : 'Clear'}
                </div>
              </div>
            </WorkspaceGate>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />Next Appt</div>
              <div className="font-medium truncate">
                {upcoming ? `${fmtPatientDate(upcoming.appointment_date)} · ${upcoming.appointment_time}` : '—'}
              </div>
            </div>
          </div>

          {clinical?.current_treatment && (
            <div className="mt-3 p-2.5 rounded-lg bg-[#0D9488]/5 border border-[#0D9488]/15 text-sm">
              <span className="text-xs font-medium text-[#0D9488]">Current Treatment · </span>
              <span className="text-foreground">{clinical.current_treatment}</span>
            </div>
          )}

          {patient.allergies && (
            <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900">
              <div className="flex items-center gap-1.5 text-red-700 dark:text-red-300 text-xs font-semibold"><AlertTriangle className="w-3.5 h-3.5" />Allergies</div>
              <div className="text-sm text-red-900 dark:text-red-200 mt-0.5">{patient.allergies}</div>
            </div>
          )}

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map(c => (
                <span key={c.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CHIP_COLORS[c.color]}`}>{c.label}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
