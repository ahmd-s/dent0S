'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import WorkspaceEditor from './WorkspaceEditor'
import {
  EDITOR_TABS,
  ROLE_LABELS,
  LOCKED_NAV_KEYS,
  configsEqual,
  deepCloneRoleConfig,
  deepCloneWorkspace,
  normalizeWidgetOrder,
  validateRoleConfigForSave,
} from '@/lib/workspace-ui-schema'
import { createPreset } from '@/lib/workspace-engine'
import { buildBuiltinPresetConfig } from '@/lib/workspace-role-experience'

const ROLES = ['admin', 'doctor', 'receptionist']

function normalizeRoleConfig(config) {
  if (!config) return config
  const next = deepCloneRoleConfig(config)
  next.layout = {
    ...next.layout,
    widget_order: normalizeWidgetOrder(next.layout?.widget_order),
  }
  for (const key of LOCKED_NAV_KEYS) {
    if (next.navigation) next.navigation[key] = true
  }
  return next
}

export default function WorkspaceBuilder() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [presetBusy, setPresetBusy] = useState(false)
  const [error, setError] = useState(null)

  const [workspace, setWorkspace] = useState(null)
  const [savedWorkspace, setSavedWorkspace] = useState(null)
  const [templates, setTemplates] = useState(null)

  const [previewRole, setPreviewRole] = useState('admin')
  const [activeTab, setActiveTab] = useState('navigation')

  const [draft, setDraft] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const [resetDialog, setResetDialog] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/settings/workspace')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load workspace')
      setWorkspace(d.workspace)
      setSavedWorkspace(deepCloneWorkspace(d.workspace))
      setTemplates(d.templates || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const previewConfig = useMemo(() => {
    if (!workspace) return null
    return normalizeRoleConfig(workspace[previewRole])
  }, [workspace, previewRole])

  useEffect(() => {
    if (previewConfig) setDraft(deepCloneRoleConfig(previewConfig))
  }, [previewConfig])

  const dirty = useMemo(() => {
    if (!workspace || !savedWorkspace || !draft) return false
    return !configsEqual(
      normalizeRoleConfig(draft),
      normalizeRoleConfig(savedWorkspace[previewRole])
    )
  }, [workspace, savedWorkspace, draft, previewRole])

  const switchPreviewRole = role => {
    if (role === previewRole) return
    if (dirty && !window.confirm('You have unsaved changes. Switch role and discard them?')) return
    setPreviewRole(role)
    setSaveState('idle')
    setError(null)
  }

  const updateDraft = next => {
    setDraft(normalizeRoleConfig(next))
    setWorkspace(prev => ({ ...prev, [previewRole]: normalizeRoleConfig(next) }))
    setSaveState('idle')
  }

  const persistWorkspace = async (nextWorkspace, extraBody = {}) => {
    const r = await fetch('/api/settings/workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace: nextWorkspace, ...extraBody }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || 'Save failed')
    setWorkspace(d.workspace)
    setSavedWorkspace(deepCloneWorkspace(d.workspace))
    setSaveState('saved')
    window.dispatchEvent(new Event('dentos:workspace-updated'))
    return d.workspace
  }

  const handleSave = async () => {
    const validation = validateRoleConfigForSave(draft)
    if (!validation.ok) {
      setSaveState('error')
      setError(validation.error)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: previewRole, config: draft }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Save failed')

      setWorkspace(d.workspace)
      setSavedWorkspace(deepCloneWorkspace(d.workspace))
      setSaveState('saved')
      window.dispatchEvent(new Event('dentos:workspace-updated'))
    } catch (e) {
      setSaveState('error')
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!resetDialog) return
    setResetting(true)
    setError(null)
    try {
      const body =
        resetDialog === 'all'
          ? { reset: 'all' }
          : resetDialog === 'role'
            ? { reset: 'role', role: previewRole }
            : { reset: 'section', role: previewRole, section: resetDialog }

      const r = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Reset failed')

      setWorkspace(d.workspace)
      setSavedWorkspace(deepCloneWorkspace(d.workspace))
      setSaveState('saved')
      setResetDialog(null)
      window.dispatchEvent(new Event('dentos:workspace-updated'))
    } catch (e) {
      setError(e.message)
    } finally {
      setResetting(false)
    }
  }

  const updatePresets = async nextPresets => {
    setPresetBusy(true)
    setError(null)
    try {
      await persistWorkspace({ ...savedWorkspace, presets: nextPresets }, {
        presets: nextPresets,
        preset_action: 'update',
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setPresetBusy(false)
    }
  }

  const presetHandlers = {
    busy: presetBusy,
    onSavePreset: async name => {
      const preset = createPreset({ name, role: previewRole, config: draft })
      const next = [...(savedWorkspace?.presets || []), preset]
      await updatePresets(next)
    },
    onApplyPreset: async presetId => {
      setPresetBusy(true)
      try {
        const r = await fetch('/api/settings/workspace', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset_action: 'apply', preset_id: presetId }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Apply failed')
        setWorkspace(d.workspace)
        setSavedWorkspace(deepCloneWorkspace(d.workspace))
        window.dispatchEvent(new Event('dentos:workspace-updated'))
      } catch (e) {
        setError(e.message)
      } finally {
        setPresetBusy(false)
      }
    },
    onRenamePreset: async (presetId, name) => {
      const next = (savedWorkspace?.presets || []).map(p =>
        p.id === presetId ? { ...p, name, updated_at: new Date().toISOString() } : p
      )
      await updatePresets(next)
    },
    onDeletePreset: async presetId => {
      const next = (savedWorkspace?.presets || []).filter(p => p.id !== presetId)
      await updatePresets(next)
    },
    onDuplicatePreset: async presetId => {
      const source = (savedWorkspace?.presets || []).find(p => p.id === presetId)
      if (!source) return
      const copy = createPreset({
        name: `${source.name} (copy)`,
        role: source.role,
        config: source.config,
      })
      await updatePresets([...(savedWorkspace?.presets || []), copy])
    },
    onApplyBuiltin: async presetId => {
      const config = buildBuiltinPresetConfig(presetId, templates || savedWorkspace)
      if (!config) return
      setPresetBusy(true)
      try {
        const r = await fetch('/api/settings/workspace', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: previewRole, config, preset_action: 'apply_builtin', preset_id: presetId }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Apply failed')
        setWorkspace(d.workspace)
        setSavedWorkspace(deepCloneWorkspace(d.workspace))
        window.dispatchEvent(new Event('dentos:workspace-updated'))
      } catch (e) {
        setError(e.message)
      } finally {
        setPresetBusy(false)
      }
    },
  }

  const editorTabs = useMemo(
    () => [...EDITOR_TABS, { id: 'reset', label: 'Reset' }],
    []
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
      </div>
    )
  }

  if (error && !workspace) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Role Experience Builder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Design what Admin, Doctor, and Receptionist see — dashboard, sidebar, patient page, and actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={previewRole} onValueChange={switchPreviewRole}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Preview as" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(r => (
                <SelectItem key={r} value={r}>
                  Preview as {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setActiveTab('reset')}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            className="h-9 bg-[#0D9488] hover:bg-[#0B7E73]"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 min-h-[24px]">
        {dirty ? (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Unsaved changes
          </span>
        ) : saveState === 'saved' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" />
            Saved successfully
          </span>
        ) : null}
        {error && workspace ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-48 shrink-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Roles
          </p>
          <nav className="space-y-0.5">
            {ROLES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => switchPreviewRole(r)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                  previewRole === r
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </nav>
          <p className="text-[11px] text-muted-foreground mt-4 px-1 leading-relaxed">
            Editing {ROLE_LABELS[previewRole]} experience. Preview uses unsaved draft state instantly.
          </p>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex gap-1 overflow-x-auto border-b border-border mb-4 pb-px">
            {editorTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-[#0D9488] text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <WorkspaceEditor
            activeTab={activeTab}
            config={draft}
            onChange={updateDraft}
            previewRole={previewRole}
            presets={savedWorkspace?.presets || []}
            presetHandlers={presetHandlers}
            resetDialog={resetDialog}
            setResetDialog={setResetDialog}
            onConfirmReset={handleReset}
            resetting={resetting}
          />
        </div>
      </div>
    </div>
  )
}
