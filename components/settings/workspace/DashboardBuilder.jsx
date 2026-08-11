'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionPanel } from './ToggleSection'
import DragOrderList from './DragOrderList'
import {
  DASHBOARD_FIELDS,
  DASHBOARD_SIZE_LABELS,
  DASHBOARD_WIDGET_SIZES,
  WIDGET_LABELS,
} from '@/lib/workspace-ui-schema'
import { defaultWidgetMeta } from '@/lib/workspace-role-experience'

function setDashboardFlag(config, key, value, onChange) {
  onChange({
    ...config,
    dashboard: { ...config.dashboard, [key]: value },
  })
}

function setWidgetMeta(config, key, patch, onChange) {
  const current = config.layout?.widget_meta?.[key] || defaultWidgetMeta(key)
  onChange({
    ...config,
    layout: {
      ...config.layout,
      widget_meta: {
        ...config.layout?.widget_meta,
        [key]: { ...current, ...patch },
      },
    },
  })
}

export default function DashboardBuilder({ config, onChange }) {
  const order = config.layout?.widget_order || DASHBOARD_FIELDS.map(f => f.key)

  return (
    <SectionPanel>
      <DragOrderList
        title="Widget order"
        description="Drag to reorder dashboard widgets. Only widgets with components render in the live app."
        items={order}
        labels={WIDGET_LABELS}
        onChange={next =>
          onChange({
            ...config,
            layout: { ...config.layout, widget_order: next },
          })
        }
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground">Widget settings</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visibility, size, collapsed state, and refresh priority per widget.
          </p>
        </div>
        <div className="divide-y divide-border/60">
          {DASHBOARD_FIELDS.map(field => {
            const meta = config.layout?.widget_meta?.[field.key] || defaultWidgetMeta(field.key)
            const visible = config.dashboard?.[field.key] === true
            return (
              <div key={field.key} className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-medium">{field.label}</Label>
                  <Switch
                    checked={visible}
                    onCheckedChange={v => setDashboardFlag(config, field.key, v, onChange)}
                  />
                </div>
                {visible && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-0 sm:pl-1">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Size</Label>
                      <Select
                        value={meta.size}
                        onValueChange={v => setWidgetMeta(config, field.key, { size: v }, onChange)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DASHBOARD_WIDGET_SIZES.map(s => (
                            <SelectItem key={s} value={s}>{DASHBOARD_SIZE_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Refresh priority</Label>
                      <Select
                        value={String(meta.refresh_priority)}
                        onValueChange={v =>
                          setWidgetMeta(config, field.key, { refresh_priority: Number(v) }, onChange)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Switch
                          checked={meta.collapsed}
                          onCheckedChange={v =>
                            setWidgetMeta(config, field.key, { collapsed: v }, onChange)
                          }
                        />
                        Collapsed by default
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </SectionPanel>
  )
}
