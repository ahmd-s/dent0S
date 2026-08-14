'use client'

import { Switch } from '@/components/ui/switch'
import { ToggleRow, ToggleSection, SectionPanel } from './ToggleSection'
import DragOrderList from './DragOrderList'
import { NAVIGATION_FIELDS, LOCKED_NAV_KEYS } from '@/lib/workspace-ui-schema'

function setNavFlag(config, key, value, onChange) {
  if (LOCKED_NAV_KEYS.includes(key) && !value) return
  onChange({
    ...config,
    navigation: { ...config.navigation, [key]: value },
  })
}

function setNavMeta(config, key, patch, onChange) {
  onChange({
    ...config,
    layout: {
      ...config.layout,
      nav_meta: {
        ...config.layout?.nav_meta,
        [key]: { ...config.layout?.nav_meta?.[key], ...patch },
      },
    },
  })
}

const NAV_LABELS = Object.fromEntries(NAVIGATION_FIELDS.map(f => [f.key, f.label]))

export default function SidebarBuilder({ config, onChange }) {
  const order = config.layout?.nav_order || NAVIGATION_FIELDS.map(f => f.key)

  return (
    <SectionPanel>
      <DragOrderList
        title="Sidebar order"
        description="Drag to reorder navigation items. Locked items stay enabled."
        items={order}
        labels={NAV_LABELS}
        onChange={next =>
          onChange({
            ...config,
            layout: { ...config.layout, nav_order: next },
          })
        }
      />

      <ToggleSection
        title="Navigation visibility"
        description="Control which modules appear in the sidebar for this role."
      >
        {NAVIGATION_FIELDS.map(field => (
          <div key={field.key} className="space-y-2">
            <ToggleRow
              label={field.label}
              checked={config.navigation?.[field.key]}
              locked={field.locked}
              onCheckedChange={v => setNavFlag(config, field.key, v, onChange)}
            />
            {config.navigation?.[field.key] && (
              <div className="pl-4 pb-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Switch
                    checked={config.layout?.nav_meta?.[field.key]?.badge_enabled === true}
                    onCheckedChange={v =>
                      setNavMeta(config, field.key, { badge_enabled: v }, onChange)
                    }
                  />
                  Show badge
                </label>
              </div>
            )}
          </div>
        ))}
      </ToggleSection>
    </SectionPanel>
  )
}
