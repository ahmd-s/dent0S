'use client'

import { useRouter } from 'next/navigation'
import { FlaskConical, Plus, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LAB_CASE_STATUS_META, statusLabel } from '@/lib/lab-case-helpers'
import { fmtPatientDate } from '@/lib/patient-clinical'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'

const labStatusBadge = s => {
  const cls = LAB_CASE_STATUS_META[s]?.badge || 'bg-slate-100 text-slate-700'
  return <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${cls}`}>{statusLabel(s)}</span>
}

export default function PatientLabPanel({ labCases = [], onNewLab, readonly = false }) {
  const router = useRouter()
  const open = labCases.filter(c => !['delivered', 'cancelled'].includes(c.status))
  const closed = labCases.filter(c => ['delivered', 'cancelled'].includes(c.status))

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{open.length}</strong> active</span>
          <span><strong className="text-foreground">{closed.length}</strong> closed</span>
        </div>
        {!readonly && (
          <Button size="sm" onClick={onNewLab} className="bg-[#0D9488] hover:bg-[#0B7E73]">
            <Plus className="w-4 h-4 mr-1" />New Lab Case
          </Button>
        )}
      </div>

      {labCases.length === 0 ? (
        <Card className="p-10 text-center rounded-xl">
          <FlaskConical className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground text-sm">No lab cases for this patient</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {labCases.map(c => (
            <Card key={c.id} className="p-4 rounded-xl hover:border-[#0D9488]/30 cursor-pointer transition-colors" onClick={() => router.push(`/lab-cases/${c.id}`)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{c.case_number}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.case_type} · {c.vendor_name || 'No vendor'}</div>
                </div>
                {labStatusBadge(c.status)}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className={`flex items-center gap-1 ${c.overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                  {c.overdue && <AlertTriangle className="w-3 h-3" />}
                  Expected {c.expected_delivery_date ? fmtPatientDate(c.expected_delivery_date) : '—'}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <PatientSectionGate flag="lab_reports" readOnlyContent={readonly ? content : null}>
      {content}
    </PatientSectionGate>
  )
}
