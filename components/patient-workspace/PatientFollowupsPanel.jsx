'use client'

import { Calendar, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { fmtPatientDate } from '@/lib/patient-clinical'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'

export default function PatientFollowupsPanel({ patient }) {
  if (!patient) return null
  const today = new Date().toISOString().slice(0, 10)
  const overdue = patient.next_followup_date && patient.next_followup_date <= today

  return (
    <PatientSectionGate flag="followups">
      <Card className="p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-[#0D9488]" />
          <h3 className="font-semibold">Follow-up Schedule</h3>
        </div>
        {patient.next_followup_date ? (
          <div className={`p-4 rounded-lg ${overdue ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            {overdue && (
              <div className="flex items-center gap-1.5 text-red-700 text-sm font-medium mb-2">
                <AlertTriangle className="w-4 h-4" />Follow-up overdue
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">Next follow-up: </span>
              <strong>{fmtPatientDate(patient.next_followup_date)}</strong>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Follow-ups are set when completing a visit. Last visit: {fmtPatientDate(patient.last_visit_date)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No follow-up scheduled. Set during visit completion.</p>
        )}
      </Card>
    </PatientSectionGate>
  )
}
