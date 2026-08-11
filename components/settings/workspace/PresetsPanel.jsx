'use client'

import { useState } from 'react'
import { Copy, Loader2, Pencil, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionPanel } from './ToggleSection'
import { ROLE_LABELS } from '@/lib/workspace-ui-schema'
import { BUILTIN_PRESETS } from '@/lib/workspace-role-experience'

export default function PresetsPanel({
  previewRole,
  presets = [],
  onSavePreset,
  onApplyPreset,
  onRenamePreset,
  onDeletePreset,
  onDuplicatePreset,
  onApplyBuiltin,
  busy = false,
}) {
  const [name, setName] = useState('')
  const [renameId, setRenameId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const rolePresets = presets.filter(p => p.role === previewRole)
  const roleBuiltins = BUILTIN_PRESETS.filter(p => p.role === previewRole)

  const handleSave = () => {
    if (!name.trim()) return
    onSavePreset(name.trim())
    setName('')
  }

  return (
    <SectionPanel>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Save current configuration</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Save the current {ROLE_LABELS[previewRole]} workspace as a reusable preset.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Preset name"
            className="h-9"
          />
          <Button
            size="sm"
            className="h-9 bg-[#0D9488] hover:bg-[#0B7E73] shrink-0"
            onClick={handleSave}
            disabled={busy || !name.trim()}
          >
            Save preset
          </Button>
        </div>
      </div>

      {roleBuiltins.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground">Built-in presets</h3>
          </div>
          <ul className="divide-y divide-border/60">
            {roleBuiltins.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm">{p.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={busy}
                  onClick={() => onApplyBuiltin(p.id)}
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                  Apply
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground">Saved presets</h3>
        </div>
        {rolePresets.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No saved presets for this role yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rolePresets.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                {renameId === p.id ? (
                  <Input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm">{p.name}</span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {renameId === p.id ? (
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        onRenamePreset(p.id, renameValue)
                        setRenameId(null)
                      }}
                    >
                      Save
                    </Button>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} onClick={() => onApplyPreset(p.id)}>
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setRenameId(p.id)
                          setRenameValue(p.name)
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} onClick={() => onDuplicatePreset(p.id)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={busy} onClick={() => onDeletePreset(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionPanel>
  )
}
