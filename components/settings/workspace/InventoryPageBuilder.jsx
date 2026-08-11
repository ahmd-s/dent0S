'use client'

import { SectionPanel, ToggleRow, ToggleSection } from './ToggleSection'
import { INVENTORY_OS_PAGE_FIELDS } from '@/lib/workspace-ui-schema'

export default function InventoryPageBuilder({ config, onChange }) {
  const inventoryOsPage = config.inventory_os_page || {}

  const toggle = (key, value) => {
    onChange({
      ...config,
      inventory_os_page: { ...inventoryOsPage, [key]: value },
    })
  }

  return (
    <SectionPanel>
      <ToggleSection
        title="Inventory Intelligence"
        description="Configure Inventory Dashboard, Doctor & Reception views, purchase panel, and alerts."
      >
        {INVENTORY_OS_PAGE_FIELDS.map(field => (
          <ToggleRow
            key={field.key}
            label={field.label}
            checked={inventoryOsPage[field.key] !== false}
            onCheckedChange={v => toggle(field.key, v)}
          />
        ))}
      </ToggleSection>
    </SectionPanel>
  )
}
