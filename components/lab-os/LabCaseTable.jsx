'use client'

import { useRouter } from 'next/navigation'
import { statusLabel } from '@/lib/lab-case-helpers'
import PrimaryActions from '@/components/ui/primary-actions'
import ScanTable, { ScanRow, ScanCell } from '@/components/ui/scan-table'
import { getLabCaseActions } from './LabCaseCard'

const COLUMNS = [
  { key: 'patient', label: 'Patient' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'status', label: 'Status' },
  { key: 'due', label: 'Due' },
  { key: 'lab', label: 'Lab' },
  { key: 'action', label: '', align: 'right', width: '1%' },
]

const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

function treatmentLabel(c) {
  const type = c.case_type || 'Lab case'
  return c.tooth_numbers ? `${type} · #${c.tooth_numbers}` : type
}

export default function LabCaseTable({ cases, onAction, showActions = true, empty = 'No lab cases found' }) {
  const router = useRouter()

  if (!cases?.length) {
    return <ScanTable columns={COLUMNS} empty={empty} />
  }

  return (
    <ScanTable columns={COLUMNS}>
      {cases.map(c => {
        const overdue = !!(c.is_delayed || c.overdue) && !!c.expected_delivery_date
        const emergency = c.urgency === 'emergency'
        const urgent = c.urgency === 'urgent'
        const actions = showActions && onAction ? getLabCaseActions(c, onAction) : []

        return (
          <ScanRow key={c.id} onClick={() => router.push(`/lab-cases/${c.id}`)}>
            <ScanCell>
              <div className="font-medium leading-snug">{c.patient_name || 'Unknown patient'}</div>
              {(emergency || urgent) && (
                <div className={`text-xs mt-0.5 ${emergency ? 'text-red-600' : 'text-amber-600'}`}>
                  {emergency ? 'Emergency' : 'Urgent'}
                </div>
              )}
            </ScanCell>
            <ScanCell muted>{treatmentLabel(c)}</ScanCell>
            <ScanCell nowrap>{statusLabel(c.status)}</ScanCell>
            <ScanCell nowrap className={overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
              {fmtDate(c.expected_delivery_date)}
            </ScanCell>
            <ScanCell muted>{c.vendor_name || '—'}</ScanCell>
            <ScanCell align="right" nowrap>
              {actions.length > 0 && (
                <div onClick={e => e.stopPropagation()}>
                  <PrimaryActions actions={actions} quiet />
                </div>
              )}
            </ScanCell>
          </ScanRow>
        )
      })}
    </ScanTable>
  )
}
