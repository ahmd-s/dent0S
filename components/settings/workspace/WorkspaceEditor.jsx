'use client'

import { ToggleRow, SectionPanel } from './ToggleSection'
import {
  LAYOUT_DENSITY_OPTIONS,
  LAYOUT_VIEW_OPTIONS,
} from '@/lib/workspace-ui-schema'
import DashboardBuilder from './DashboardBuilder'
import SidebarBuilder from './SidebarBuilder'
import PatientPageBuilder from './PatientPageBuilder'
import FlowPageBuilder from './FlowPageBuilder'
import LabPageBuilder from './LabPageBuilder'
import InventoryPageBuilder from './InventoryPageBuilder'
import CommunicationPageBuilder from './CommunicationPageBuilder'
import AIPageBuilder from './AIPageBuilder'
import ActionsBuilder from './ActionsBuilder'
import QuickActionsBuilder from './QuickActionsBuilder'
import HomepageBuilder from './HomepageBuilder'
import PresetsPanel from './PresetsPanel'
import LivePreviewPanel from './LivePreviewPanel'
import ResetControls from './ResetControls'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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

export default function WorkspaceEditor({
  activeTab,
  config,
  onChange,
  previewRole,
  presets,
  presetHandlers,
  resetDialog,
  setResetDialog,
  onConfirmReset,
  resetting,
}) {
  if (!config) return null

  switch (activeTab) {
    case 'navigation':
      return <SidebarBuilder config={config} onChange={onChange} />
    case 'dashboard':
      return <DashboardBuilder config={config} onChange={onChange} />
    case 'patient_page':
      return <PatientPageBuilder config={config} onChange={onChange} />
    case 'flow_page':
      return <FlowPageBuilder config={config} onChange={onChange} />
    case 'lab_os_page':
      return <LabPageBuilder config={config} onChange={onChange} />
    case 'inventory_os_page':
      return <InventoryPageBuilder config={config} onChange={onChange} />
    case 'communication_os_page':
      return <CommunicationPageBuilder config={config} onChange={onChange} />
    case 'ai_os_page':
      return <AIPageBuilder config={config} onChange={onChange} />
    case 'actions':
      return <ActionsBuilder config={config} onChange={onChange} />
    case 'quick_actions':
      return <QuickActionsBuilder config={config} onChange={onChange} />
    case 'homepage':
      return <HomepageBuilder config={config} onChange={onChange} previewRole={previewRole} />
    case 'presets':
      return (
        <PresetsPanel
          previewRole={previewRole}
          presets={presets}
          {...presetHandlers}
        />
      )
    case 'preview':
      return <LivePreviewPanel config={config} previewRole={previewRole} />
    case 'reset':
      return (
        <ResetControls
          previewRole={previewRole}
          resetDialog={resetDialog}
          setResetDialog={setResetDialog}
          onConfirmReset={onConfirmReset}
          resetting={resetting}
        />
      )
    case 'layout':
      return <LayoutTab config={config} onChange={onChange} />
    default:
      return null
  }
}
