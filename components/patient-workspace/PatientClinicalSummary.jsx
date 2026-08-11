'use client'

import { Stethoscope, Pill, ClipboardList, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'
import { fmtPatientDate } from '@/lib/patient-clinical'

export default function PatientClinicalSummary({ clinical, readonly = false }) {
  if (!clinical) return null

  const readOnlyView = (
    <Card className="p-4 md:p-5 bg-muted/30 border-border rounded-xl space-y-4">
      <SummaryBlock icon={Stethoscope} label="Chief Complaint" value={clinical.chief_complaint} />
      <SummaryBlock icon={ClipboardList} label="Diagnosis" value={clinical.diagnosis} />
      <SummaryBlock icon={Stethoscope} label="Current Treatment" value={clinical.current_treatment} />
      {clinical.allergies && <SummaryBlock icon={AlertCircle} label="Allergies" value={clinical.allergies} alert />}
      {clinical.current_medications?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><Pill className="w-3.5 h-3.5" />Current Medications</div>
          <ul className="space-y-1 text-sm">
            {clinical.current_medications.map((m, i) => (
              <li key={i} className="text-foreground">• {m.name} {m.dosage} · {m.frequency} · {m.duration}</li>
            ))}
          </ul>
        </div>
      )}
      {clinical.pinned_notes && <SummaryBlock icon={ClipboardList} label="Internal Notes" value={clinical.pinned_notes} />}
    </Card>
  )

  return (
    <PatientSectionGate flag="clinical_notes" readOnlyContent={readonly ? readOnlyView : null}>
      <Card className="p-4 md:p-5 bg-card border-border rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#0D9488]" />Clinical Summary
          </h2>
          {clinical.latest_visit_date && (
            <span className="text-xs text-muted-foreground">Latest visit {fmtPatientDate(clinical.latest_visit_date)}</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SummaryBlock icon={Stethoscope} label="Chief Complaint" value={clinical.chief_complaint} />
          <SummaryBlock icon={ClipboardList} label="Diagnosis" value={clinical.diagnosis} />
          <SummaryBlock icon={Stethoscope} label="Current Treatment" value={clinical.current_treatment} />
          <SummaryBlock icon={ClipboardList} label="Treatment Plan" value={clinical.treatment_plan} />
        </div>

        {clinical.medical_alerts?.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medical Alerts</div>
            {clinical.medical_alerts.map((a, i) => (
              <div key={i} className={`p-2.5 rounded-lg text-sm ${a.severity === 'high' ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-amber-50 border border-amber-200 text-amber-900'}`}>
                <span className="font-medium">{a.label}: </span>{a.text}
              </div>
            ))}
          </div>
        )}

        {clinical.current_medications?.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><Pill className="w-3.5 h-3.5" />Current Medications</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {clinical.current_medications.map((m, i) => (
                <div key={i} className="p-2 rounded-md bg-muted/50 text-sm">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground"> · {m.dosage} · {m.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-4 text-sm">
          <div className="px-3 py-2 rounded-lg bg-green-50 text-green-700"><strong>{clinical.treatment_progress?.completed || 0}</strong> completed</div>
          <div className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700"><strong>{clinical.treatment_progress?.pending || 0}</strong> pending</div>
          <div className="px-3 py-2 rounded-lg bg-muted text-muted-foreground"><strong>{clinical.treatment_progress?.total_visits || 0}</strong> visits</div>
        </div>

        {clinical.clinical_notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Clinical Notes</div>
            <p className="text-sm whitespace-pre-line text-foreground">{clinical.clinical_notes}</p>
          </div>
        )}
      </Card>
    </PatientSectionGate>
  )
}

function SummaryBlock({ icon: Icon, label, value, alert }) {
  return (
    <div className={`p-3 rounded-lg ${alert ? 'bg-red-50 border border-red-100' : 'bg-muted/40'}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className="text-sm text-foreground">{value || <span className="text-muted-foreground italic">Not recorded</span>}</div>
    </div>
  )
}
