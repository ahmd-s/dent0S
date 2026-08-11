'use client'

import Link from 'next/link'
import { FileText, ExternalLink, ChevronDown, ChevronUp, FilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fmtPatientDate } from '@/lib/patient-clinical'
import { useState } from 'react'

export default function PatientTreatmentWorkspace({ visits = [], onNewVisit, canStartVisit }) {
  const [expanded, setExpanded] = useState({})

  const completed = visits.filter(v => v.treatment_done)
  const pending = visits.filter(v => v.treatment_plan && !v.treatment_done)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Completed Procedures" value={completed.length} color="green" />
        <StatCard label="Pending Plans" value={pending.length} color="amber" />
        <StatCard label="Total Visits" value={visits.length} color="teal" />
      </div>

      {visits.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border rounded-xl">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">No visits recorded yet</p>
          {canStartVisit && (
            <Button onClick={onNewVisit} className="mt-4 bg-[#0D9488] hover:bg-[#0B7E73]">
              <FilePlus className="w-4 h-4 mr-2" />Record First Visit
            </Button>
          )}
        </Card>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
          {visits.map((v, i) => (
            <div key={v.id} className="relative mb-4">
              <div className={`absolute -left-5 top-3 w-3 h-3 rounded-full ${i === 0 ? 'bg-[#0D9488] ring-4 ring-[#0D9488]/20' : 'bg-border'}`} />
              <Card className="p-5 bg-card border-border rounded-xl">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{fmtPatientDate(v.visit_date)}</div>
                    <div className="text-xs text-muted-foreground">Dr. {v.doctor_name || '—'}</div>
                  </div>
                  <Link href={`/visits/${v.id}`}>
                    <Button size="sm" variant="outline" className="h-8"><ExternalLink className="w-3.5 h-3.5 mr-1" />Open</Button>
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {v.chief_complaint && <Field label="Chief Complaint" value={v.chief_complaint} />}
                  {v.diagnosis && <Field label="Diagnosis" value={v.diagnosis} />}
                  {v.treatment_done && <Field label="Treatment Done" value={v.treatment_done} highlight />}
                  {v.treatment_plan && <Field label="Treatment Plan" value={v.treatment_plan} />}
                </div>
                <button onClick={() => setExpanded(p => ({ ...p, [v.id]: !p[v.id] }))} className="mt-3 text-xs text-[#0D9488] flex items-center gap-1">
                  Full Notes {expanded[v.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {expanded[v.id] && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
                    {v.clinical_notes && <Field label="Clinical Notes" value={v.clinical_notes} multiline />}
                    {v.prescriptions?.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Prescriptions</div>
                        <ul className="space-y-1">{v.prescriptions.map(p => (
                          <li key={p.id}>• <strong>{p.medicine_name}</strong> {p.dosage} · {p.frequency}</li>
                        ))}</ul>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = { green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700', teal: 'bg-[#0D9488]/10 text-[#0D9488]' }
  return (
    <Card className={`p-4 rounded-xl border-0 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 opacity-80">{label}</div>
    </Card>
  )
}

function Field({ label, value, highlight, multiline }) {
  return (
    <div className={highlight ? 'p-2 rounded-lg bg-[#0D9488]/5' : ''}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={multiline ? 'whitespace-pre-line' : ''}>{value}</div>
    </div>
  )
}
