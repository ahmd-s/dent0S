'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ToggleRow, ToggleSection, SectionPanel } from './ToggleSection'
import DragOrderList from './DragOrderList'
import { QUICK_ACTION_FIELDS } from '@/lib/workspace-ui-schema'

const QUICK_LABELS = Object.fromEntries(QUICK_ACTION_FIELDS.map(f => [f.key, f.label]))

function setQuickAction(config, key, value, onChange) {
  onChange({
    ...config,
    quick_actions: { ...config.quick_actions, [key]: value },
  })
}

export default function QuickActionsBuilder({ config, onChange }) {
  const order = config.layout?.quick_action_order || QUICK_ACTION_FIELDS.map(f => f.key)
  const primary = config.layout?.primary_quick_action

  return (
    <SectionPanel>
      <DragOrderList
        title="Quick action order"
        description="Drag to reorder header and patient quick actions."
        items={order}
        labels={QUICK_LABELS}
        onChange={next =>
          onChange({
            ...config,
            layout: { ...config.layout, quick_action_order: next },
          })
        }
      />

      <ToggleSection
        title="Quick actions"
        description="Toggle visibility and choose the primary action for this role."
      >
        {QUICK_ACTION_FIELDS.map(field => {
          const enabled = config.quick_actions?.[field.key] === true
          const isPrimary = primary === field.key
          return (
            <div key={field.key} className="py-2 border-b border-border/40 last:border-0">
              <ToggleRow
                label={field.label}
                checked={enabled}
                onCheckedChange={v => setQuickAction(config, field.key, v, onChange)}
              />
              {enabled && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...config,
                      layout: {
                        ...config.layout,
                        primary_quick_action: isPrimary ? null : field.key,
                      },
                    })
                  }
                  className={cn(
                    'ml-1 mt-1 text-[11px] px-2 py-0.5 rounded border transition-colors',
                    isPrimary
                      ? 'bg-[#0D9488] text-white border-[#0D9488]'
                      : 'text-muted-foreground border-border hover:bg-muted/50'
                  )}
                >
                  {isPrimary ? 'Primary action' : 'Set as primary'}
                </button>
              )}
            </div>
          )
        })}
      </ToggleSection>
    </SectionPanel>
  )
}
