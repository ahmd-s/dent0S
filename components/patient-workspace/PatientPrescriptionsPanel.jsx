'use client'

import { Pill } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'
import { fmtPatientDate } from '@/lib/patient-clinical'

export default function PatientPrescriptionsPanel({ visits = [] }) {
  const all = visits.flatMap(v => (v.prescriptions || []).map(p => ({ ...p, visit_date: v.visit_date, visit_id: v.id })))

  return (
    <PatientSectionGate flag="prescriptions">
      <Card className="p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-4"><Pill className="w-4 h-4 text-[#0D9488]" /><h3 className="font-semibold">Prescription History</h3></div>
        {all.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prescriptions recorded.</p>
        ) : (
          <div className="space-y-3">
            {all.map((p, i) => (
              <div key={p.id || i} className="p-3 rounded-lg bg-muted/40 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.medicine_name}</span>
                  <span className="text-xs text-muted-foreground">{fmtPatientDate(p.visit_date)}</span>
                </div>
                <div className="text-muted-foreground mt-0.5">{p.dosage} · {p.frequency} · {p.duration}</div>
                {p.instructions && <div className="text-xs mt-1 italic">{p.instructions}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </PatientSectionGate>
  )
}
