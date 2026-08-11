'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionPanel } from './ToggleSection'
import { PATIENT_PAGE_FIELDS, PATIENT_ACCESS_LABELS, PATIENT_ACCESS_MODES } from '@/lib/workspace-ui-schema'
import { normalizePatientAccess } from '@/lib/workspace-role-experience'

function setPatientAccess(config, key, mode, onChange) {
  onChange({
    ...config,
    patient_page: {
      ...config.patient_page,
      [key]: mode,
    },
  })
}

export default function PatientPageBuilder({ config, onChange }) {
  return (
    <SectionPanel>
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground">Patient page sections</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure each section as Hidden, Read Only, or Editable for this role.
          </p>
        </div>
        <div className="divide-y divide-border/60">
          {PATIENT_PAGE_FIELDS.map(field => {
            const mode = normalizePatientAccess(config.patient_page?.[field.key])
            return (
              <div key={field.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-foreground">{field.label}</span>
                <Select
                  value={mode}
                  onValueChange={v => setPatientAccess(config, field.key, v, onChange)}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PATIENT_ACCESS_MODES.map(m => (
                      <SelectItem key={m} value={m}>{PATIENT_ACCESS_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      </div>
    </SectionPanel>
  )
}
