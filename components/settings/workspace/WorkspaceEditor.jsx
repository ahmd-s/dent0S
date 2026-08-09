'use client'

import { ToggleRow, ToggleSection, SectionPanel } from './ToggleSection'
import {
  NAVIGATION_FIELDS,
  DASHBOARD_FIELDS,
  PATIENT_PAGE_FIELDS,
  QUICK_ACTION_FIELDS,
  LAYOUT_DENSITY_OPTIONS,
  LAYOUT_VIEW_OPTIONS,
} from '@/lib/workspace-ui-schema'
import WidgetOrderList from './WidgetOrderList'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function setSection(config, section, key, value, onChange) {
  onChange({
    ...config,
    [section]: {
      ...config[section],
      [key]: value,
    },
  })
}

function BooleanTab({ config, section, fields, onChange }) {
  return (
    <SectionPanel>
      <ToggleSection
        title="Visibility"
        description="Toggle modules and sections on or off for this role."
      >
        {fields.map(field => (
          <ToggleRow
            key={field.key}
            label={field.label}
            checked={config[section]?.[field.key]}
            locked={field.locked}
            onCheckedChange={v => setSection(config, section, field.key, v, onChange)}
          />
        ))}
      </ToggleSection>
    </SectionPanel>
  )
}

function LayoutTab({ config, onChange }) {
  const layout = config.layout || {}

  const setLayout = (key, value) => {
    onChange({
      ...config,
      layout: { ...layout, [key]: value },
    })
  }

  return (
    <SectionPanel>
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground">Density</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Spacing between elements</p>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {LAYOUT_DENSITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLayout('density', opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md border transition-colors',
                layout.density === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground">View mode</h3>
          <p className="text-xs text-muted-foreground mt-0.5">How lists and panels are displayed</p>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {LAYOUT_VIEW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLayout('view_mode', opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md border transition-colors',
                layout.view_mode === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-3">
        <div>
          <Label className="text-sm font-medium">Sidebar</Label>
          <p className="text-xs text-muted-foreground">Start with sidebar collapsed</p>
        </div>
        <ToggleRow
          label="Collapsed sidebar"
          checked={layout.sidebar_collapsed}
          onCheckedChange={v => setLayout('sidebar_collapsed', v)}
        />
      </div>
    </SectionPanel>
  )
}

export default function WorkspaceEditor({ activeTab, config, onChange }) {
  if (!config) return null

  switch (activeTab) {
    case 'navigation':
      return (
        <BooleanTab
          config={config}
          section="navigation"
          fields={NAVIGATION_FIELDS}
          onChange={onChange}
        />
      )
    case 'dashboard':
      return (
        <BooleanTab
          config={config}
          section="dashboard"
          fields={DASHBOARD_FIELDS}
          onChange={onChange}
        />
      )
    case 'patient_page':
      return (
        <BooleanTab
          config={config}
          section="patient_page"
          fields={PATIENT_PAGE_FIELDS}
          onChange={onChange}
        />
      )
    case 'quick_actions':
      return (
        <BooleanTab
          config={config}
          section="quick_actions"
          fields={QUICK_ACTION_FIELDS}
          onChange={onChange}
        />
      )
    case 'widgets':
      return (
        <SectionPanel>
          <WidgetOrderList
            order={config.layout?.widget_order || []}
            onChange={order =>
              onChange({
                ...config,
                layout: { ...config.layout, widget_order: order },
              })
            }
          />
        </SectionPanel>
      )
    case 'layout':
      return <LayoutTab config={config} onChange={onChange} />
    default:
      return null
  }
}
