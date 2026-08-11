'use client'

import { SectionPanel, ToggleRow, ToggleSection } from './ToggleSection'
import { COMMUNICATION_OS_PAGE_FIELDS } from '@/lib/workspace-ui-schema'

export default function CommunicationPageBuilder({ config, onChange }) {
  const communicationOsPage = config.communication_os_page || {}

  const toggle = (key, value) => {
    onChange({
      ...config,
      communication_os_page: { ...communicationOsPage, [key]: value },
    })
  }

  return (
    <SectionPanel>
      <ToggleSection
        title="Communication OS"
        description="Configure Communication Dashboard, Campaign Center, Review Panel, Reminder Center, and Timeline."
      >
        {COMMUNICATION_OS_PAGE_FIELDS.map(field => (
          <ToggleRow
            key={field.key}
            label={field.label}
            checked={communicationOsPage[field.key] !== false}
            onCheckedChange={v => toggle(field.key, v)}
          />
        ))}
      </ToggleSection>
    </SectionPanel>
  )
}
