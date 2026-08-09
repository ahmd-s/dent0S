'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function ToggleRow({ label, description, checked, onCheckedChange, locked = false, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <div className="min-w-0 flex-1">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        ) : null}
        {locked ? (
          <p className="text-[11px] text-muted-foreground mt-0.5">Required — cannot be disabled</p>
        ) : null}
      </div>
      <Switch
        checked={!!checked}
        onCheckedChange={onCheckedChange}
        disabled={locked || disabled}
        aria-label={label}
      />
    </div>
  )
}

export function ToggleSection({ title, description, children }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

export function SectionPanel({ children }) {
  return <div className="space-y-4 max-w-2xl">{children}</div>
}
