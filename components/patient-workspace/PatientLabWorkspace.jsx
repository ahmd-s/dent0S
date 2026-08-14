'use client'

import { useEffect, useState } from 'react'
import LabCaseCard from '@/components/lab-os/LabCaseCard'
import LabTimeline from '@/components/lab-os/LabTimeline'
import VendorDashboardPanel from '@/components/lab-os/VendorDashboardPanel'
import { Card } from '@/components/ui/card'
import { CLOSED_STATUSES, normalizeLabStatus, LAB_CASE_STATUS_META, statusLabel } from '@/lib/lab-case-helpers'
import { fmtPatientDate } from '@/lib/patient-clinical'
import LazyTabPanel from './LazyTabPanel'

export default function PatientLabWorkspace({ patientId, labCases = [], onNewLab, readonly = false, activeTab }) {
  const [current, setCurrent] = useState(null)

  const open = labCases.filter(c => !CLOSED_STATUSES.includes(normalizeLabStatus(c.status)))
  const active = open[0] || labCases[0]

  useEffect(() => {
    setCurrent(active || null)
  }, [active, labCases])

  if (!labCases.length) {
    return (
      <Card className="p-10 text-center rounded-xl">
        <p className="text-muted-foreground text-sm">No lab cases for this patient</p>
        {!readonly && onNewLab && (
          <button onClick={onNewLab} className="mt-3 text-sm text-[#0D9488] hover:underline">Create lab case</button>
        )}
      </Card>
    )
  }

  return (
    <LazyTabPanel tabId="lab" activeTab={activeTab}>
      <div className="space-y-4">
        {current && (
          <Card className="p-4 border-[#0D9488]/20">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">Current Lab Case</h3>
                <p className="text-xs text-muted-foreground">{current.case_number} · {current.case_type}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${LAB_CASE_STATUS_META[current.status]?.badge || ''}`}>
                {statusLabel(current.status)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
              <Info label="Vendor" value={current.vendor_name || '—'} />
              <Info label="Due Date" value={current.expected_delivery_date ? fmtPatientDate(current.expected_delivery_date) : '—'} />
              <Info label="Est. Delivery" value={current.estimated_completion ? fmtPatientDate(current.estimated_completion) : '—'} />
              <Info label="STL" value={current.stl_uploaded ? 'Uploaded' : 'Pending'} />
            </div>
            {current.vendor_id && <VendorDashboardPanel vendorId={current.vendor_id} />}
          </Card>
        )}

        {current && <LabTimeline labCaseId={current.id} />}

        <section>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">All Cases ({labCases.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {labCases.map(c => (
              <LabCaseCard key={c.id} labCase={c} showActions={!readonly} />
            ))}
          </div>
        </section>
      </div>
    </LazyTabPanel>
  )
}

function Info({ label, value }) {
  return (
    <div className="p-2 rounded-lg bg-muted/50">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  )
}
