'use client'

import { useEffect, useState } from 'react'
import LabCaseTable from '@/components/lab-os/LabCaseTable'
import LabTimeline from '@/components/lab-os/LabTimeline'
import VendorDashboardPanel from '@/components/lab-os/VendorDashboardPanel'
import { Card } from '@/components/ui/card'
import { CLOSED_STATUSES, normalizeLabStatus, statusLabel } from '@/lib/lab-case-helpers'
import { fmtPatientDate } from '@/lib/patient-clinical'
import LazyTabPanel from './LazyTabPanel'

export default function PatientLabWorkspace({ patientId: _patientId, labCases = [], onNewLab, readonly = false, activeTab }) {
  const [current, setCurrent] = useState(null)

  const open = labCases.filter(c => !CLOSED_STATUSES.includes(normalizeLabStatus(c.status)))
  const active = open[0] || labCases[0]

  useEffect(() => {
    setCurrent(active || null)
  }, [active, labCases])

  if (!labCases.length) {
    return (
      <Card className="p-10 text-center rounded-xl border-border/70">
        <p className="text-muted-foreground text-sm">No lab cases for this patient</p>
        {!readonly && onNewLab && (
          <button onClick={onNewLab} className="mt-3 text-sm text-primary hover:underline">Create lab case</button>
        )}
      </Card>
    )
  }

  return (
    <LazyTabPanel tabId="lab" activeTab={activeTab}>
      <div className="space-y-6">
        {current && (
          <Card className="p-5 border-border/70">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-[15px]">{current.case_type || 'Current case'}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{current.case_number}</p>
              </div>
              <span className="text-sm text-foreground">{statusLabel(current.status)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {[current.vendor_name, current.expected_delivery_date ? `Due ${fmtPatientDate(current.expected_delivery_date)}` : null].filter(Boolean).join(' · ')}
            </p>
            {current.vendor_id && <div className="mt-3"><VendorDashboardPanel vendorId={current.vendor_id} /></div>}
          </Card>
        )}

        {current && <LabTimeline labCaseId={current.id} />}

        <section>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">All cases · {labCases.length}</h4>
          <LabCaseTable cases={labCases} showActions={false} />
        </section>
      </div>
    </LazyTabPanel>
  )
}
