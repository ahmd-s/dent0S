'use client'

import { useMemo } from 'react'
import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionPanel } from './ToggleSection'
import {
  NAVIGATION_FIELDS,
  DASHBOARD_FIELDS,
  PATIENT_PAGE_FIELDS,
  QUICK_ACTION_FIELDS,
  ROLE_LABELS,
  HOMEPAGE_OPTIONS,
} from '@/lib/workspace-ui-schema'
import { normalizePatientAccess } from '@/lib/workspace-role-experience'
import { NAV_REGISTRY } from '@/lib/workspace-nav-registry'

export default function LivePreviewPanel({ config, previewRole }) {
  const navItems = useMemo(() => {
    const order = config.layout?.nav_order || NAVIGATION_FIELDS.map(f => f.key)
    return order
      .filter(key => config.navigation?.[key] === true)
      .map(key => ({
        key,
        label: NAVIGATION_FIELDS.find(f => f.key === key)?.label || NAV_REGISTRY[key]?.label || key,
      }))
  }, [config])

  const widgets = useMemo(() => {
    const order = config.layout?.widget_order || DASHBOARD_FIELDS.map(f => f.key)
    return order.filter(key => config.dashboard?.[key] === true).map(key => ({
      key,
      label: DASHBOARD_FIELDS.find(f => f.key === key)?.label || key,
      meta: config.layout?.widget_meta?.[key],
    }))
  }, [config])

  const quickActions = useMemo(() => {
    const order = config.layout?.quick_action_order || QUICK_ACTION_FIELDS.map(f => f.key)
    return order
      .filter(key => config.quick_actions?.[key] === true)
      .map(key => ({
        key,
        label: QUICK_ACTION_FIELDS.find(f => f.key === key)?.label || key,
        primary: config.layout?.primary_quick_action === key,
      }))
  }, [config])

  const homepage = HOMEPAGE_OPTIONS.find(o => o.value === config.homepage?.landing)?.label || 'Dashboard'

  return (
    <SectionPanel>
      <div className="rounded-lg border border-[#0D9488]/30 bg-[#0D9488]/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[#0D9488]">
          <Eye className="w-4 h-4" />
          Preview as {ROLE_LABELS[previewRole]} — unsaved draft
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          This preview reflects your current editor state without saving or reloading.
        </p>
      </div>

      <PreviewBlock title="Homepage" items={[`Landing: ${homepage}`]} />
      <PreviewBlock
        title="Sidebar"
        items={navItems.map(n => n.label)}
        empty="No navigation items enabled"
      />
      <PreviewBlock
        title="Dashboard widgets"
        items={widgets.map(w => {
          const parts = [w.label]
          if (w.meta?.size) parts.push(w.meta.size)
          if (w.meta?.collapsed) parts.push('collapsed')
          return parts.join(' · ')
        })}
        empty="No dashboard widgets enabled"
      />
      <PreviewBlock
        title="Quick actions"
        items={quickActions.map(q => (q.primary ? `${q.label} (primary)` : q.label))}
        empty="No quick actions enabled"
      />
      <PreviewBlock
        title="Patient page sections"
        items={PATIENT_PAGE_FIELDS.filter(f => {
          const mode = normalizePatientAccess(config.patient_page?.[f.key])
          return mode !== 'hidden'
        }).map(f => {
          const mode = normalizePatientAccess(config.patient_page?.[f.key])
          return `${f.label}: ${mode === 'readonly' ? 'Read Only' : 'Editable'}`
        })}
        empty="All patient sections hidden"
      />
    </SectionPanel>
  )
}

function PreviewBlock({ title, items, empty }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="px-4 py-2 divide-y divide-border/40">
          {items.map((item, i) => (
            <li key={i} className="py-2 text-sm text-foreground">{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
