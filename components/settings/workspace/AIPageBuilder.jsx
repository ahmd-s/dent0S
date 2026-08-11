'use client'

import { SectionPanel, ToggleRow, ToggleSection } from './ToggleSection'
import { AI_OS_PAGE_FIELDS } from '@/lib/workspace-ui-schema'

export default function AIPageBuilder({ config, onChange }) {
  const aiOsPage = config.ai_os_page || {}

  const toggle = (key, value) => {
    onChange({ ...config, ai_os_page: { ...aiOsPage, [key]: value } })
  }

  return (
    <SectionPanel>
      <ToggleSection title="AI Clinical Assistant" description="Configure AI Dashboard, Copilot, Voice Assistant, and Automation panels.">
        {AI_OS_PAGE_FIELDS.map(field => (
          <ToggleRow key={field.key} label={field.label} checked={aiOsPage[field.key] !== false} onCheckedChange={v => toggle(field.key, v)} />
        ))}
      </ToggleSection>
    </SectionPanel>
  )
}
