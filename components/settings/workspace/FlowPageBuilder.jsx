'use client'

import { SectionPanel, ToggleRow, ToggleSection } from './ToggleSection'
import { FLOW_PAGE_FIELDS } from '@/lib/workspace-ui-schema'

export default function FlowPageBuilder({ config, onChange }) {
  const flowPage = config.flow_page || {}

  const toggle = (key, value) => {
    onChange({
      ...config,
      flow_page: { ...flowPage, [key]: value },
    })
  }

  return (
    <SectionPanel>
      <ToggleSection
        title="Dental Flow Engine"
        description="Configure Reception Dashboard, Doctor Dashboard, Chair Board, Queue Board, and flow UI options."
      >
        {FLOW_PAGE_FIELDS.map(field => (
          <ToggleRow
            key={field.key}
            label={field.label}
            checked={flowPage[field.key] !== false}
            onCheckedChange={v => toggle(field.key, v)}
          />
        ))}
      </ToggleSection>
    </SectionPanel>
  )
}
