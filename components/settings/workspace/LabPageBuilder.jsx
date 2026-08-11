'use client'

import { SectionPanel, ToggleRow, ToggleSection } from './ToggleSection'
import { LAB_OS_PAGE_FIELDS } from '@/lib/workspace-ui-schema'

export default function LabPageBuilder({ config, onChange }) {
  const labOsPage = config.lab_os_page || {}

  const toggle = (key, value) => {
    onChange({
      ...config,
      lab_os_page: { ...labOsPage, [key]: value },
    })
  }

  return (
    <SectionPanel>
      <ToggleSection
        title="Lab Operating System"
        description="Configure Lab Workflow Dashboard, Doctor/Reception lab views, vendor panel, and delivery tracking."
      >
        {LAB_OS_PAGE_FIELDS.map(field => (
          <ToggleRow
            key={field.key}
            label={field.label}
            checked={labOsPage[field.key] !== false}
            onCheckedChange={v => toggle(field.key, v)}
          />
        ))}
      </ToggleSection>
    </SectionPanel>
  )
}
