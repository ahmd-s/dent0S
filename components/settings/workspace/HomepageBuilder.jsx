'use client'

import { cn } from '@/lib/utils'
import { SectionPanel } from './ToggleSection'
import { HOMEPAGE_OPTIONS, ROLE_LABELS } from '@/lib/workspace-ui-schema'

export default function HomepageBuilder({ config, onChange, previewRole }) {
  const landing = config.homepage?.landing || 'dashboard'

  return (
    <SectionPanel>
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground">Default landing page</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose where {ROLE_LABELS[previewRole]} lands after sign-in.
          </p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {HOMEPAGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onChange({
                  ...config,
                  homepage: { landing: opt.value },
                })
              }
              className={cn(
                'text-left px-4 py-3 rounded-md border transition-colors',
                landing === opt.value
                  ? 'bg-[#0D9488]/10 border-[#0D9488] text-foreground'
                  : 'bg-background border-border hover:bg-muted/50'
              )}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{opt.href}</div>
            </button>
          ))}
        </div>
      </div>
    </SectionPanel>
  )
}
