'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ToggleRow, ToggleSection, SectionPanel } from './ToggleSection'
import { ACTION_MODULE_TABS } from '@/lib/workspace-ui-schema'

function setAction(config, section, key, permissionKey, value, onChange) {
  const next = { ...config }
  if (section === 'permissions') {
    next.permissions = { ...config.permissions, [permissionKey]: value }
  } else {
    next[section] = { ...config[section], [key]: value }
  }
  onChange(next)
}

export default function ActionsBuilder({ config, onChange }) {
  const [moduleId, setModuleId] = useState(ACTION_MODULE_TABS[0].id)
  const active = ACTION_MODULE_TABS.find(m => m.id === moduleId) || ACTION_MODULE_TABS[0]

  return (
    <SectionPanel>
      <div className="flex gap-1 overflow-x-auto border-b border-border mb-4 pb-px">
        {ACTION_MODULE_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setModuleId(tab.id)}
            className={cn(
              'px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              moduleId === tab.id
                ? 'border-[#0D9488] text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ToggleSection
        title={`${active.label} actions`}
        description="These hide UI controls and feed the authorization engine. They do not replace RBAC."
      >
        {active.fields.map(field => {
          const permKey = field.permission || field.key
          const checked =
            active.section === 'permissions'
              ? config.permissions?.[permKey] === true
              : config[active.section]?.[field.key] === true
          return (
            <ToggleRow
              key={field.key}
              label={field.label}
              checked={checked}
              onCheckedChange={v =>
                setAction(config, active.section, field.key, permKey, v, onChange)
              }
            />
          )
        })}
      </ToggleSection>
    </SectionPanel>
  )
}
