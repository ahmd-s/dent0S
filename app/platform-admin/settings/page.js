'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Save, Settings, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

function SettingsSection({ title, description, children, onSave, saving }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <Button size="sm" onClick={onSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  // Local form state
  const [trial, setTrial] = useState(14)
  const [grace, setGrace] = useState(7)
  const [aiLimit, setAiLimit] = useState('')
  const [brandName, setBrandName] = useState('DentOS')
  const [supportEmail, setSupportEmail] = useState('support@dent-os.in')
  const [templates, setTemplates] = useState([])
  const [newTplLabel, setNewTplLabel] = useState('')
  const [newTplBody, setNewTplBody] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/platform-admin/settings')
      if (!r.ok) throw new Error()
      const d = await r.json()
      const s = d.settings || {}
      setSettings(s)
      setTrial(s.trial_length_days ?? 14)
      setGrace(s.grace_period_days ?? 7)
      setAiLimit(s.default_ai_limit != null ? String(s.default_ai_limit) : '')
      setBrandName(s.branding?.name || 'DentOS')
      setSupportEmail(s.branding?.support_email || 'support@dent-os.in')
      setTemplates(s.broadcast_templates || [])
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (key, data) => {
    setSaving(key)
    try {
      const r = await fetch('/api/platform-admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed'); return }
      toast.success('Settings saved')
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(null)
    }
  }

  const addTemplate = () => {
    if (!newTplLabel.trim() || !newTplBody.trim()) {
      toast.error('Label and body are required')
      return
    }
    const next = [...templates, { label: newTplLabel.trim(), body: newTplBody.trim() }]
    setTemplates(next)
    setNewTplLabel('')
    setNewTplBody('')
    save('templates', { broadcast_templates: next })
  }

  const removeTemplate = (i) => {
    const next = templates.filter((_, idx) => idx !== i)
    setTemplates(next)
    save('templates', { broadcast_templates: next })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Platform Settings</h1>
          <p className="text-sm text-muted-foreground">
            Global defaults and configuration. Changes are audited.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trial & Grace */}
        <SettingsSection
          title="Trial & Grace Periods"
          description="Default values for new clinic subscriptions."
          saving={saving === 'billing'}
          onSave={() => save('billing', {
            trial_length_days: Number(trial),
            grace_period_days: Number(grace),
          })}
        >
          <div className="space-y-1.5">
            <Label>Trial Length (days)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={trial}
              onChange={e => setTrial(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Current: {settings?.trial_length_days ?? 14} days</p>
          </div>
          <div className="space-y-1.5">
            <Label>Grace Period (days)</Label>
            <Input
              type="number"
              min={0}
              max={90}
              value={grace}
              onChange={e => setGrace(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Current: {settings?.grace_period_days ?? 7} days</p>
          </div>
        </SettingsSection>

        {/* AI Limits */}
        <SettingsSection
          title="AI & Usage Limits"
          description="Default limits applied to new clinics."
          saving={saving === 'ai'}
          onSave={() => save('ai', {
            default_ai_limit: aiLimit !== '' ? Number(aiLimit) : null,
          })}
        >
          <div className="space-y-1.5">
            <Label>Default Monthly AI Request Limit</Label>
            <Input
              type="number"
              min={0}
              placeholder="Leave empty for unlimited"
              value={aiLimit}
              onChange={e => setAiLimit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Current: {settings?.default_ai_limit != null ? `${settings.default_ai_limit} requests/month` : 'Unlimited'}
            </p>
          </div>
        </SettingsSection>

        {/* Branding */}
        <SettingsSection
          title="Platform Branding"
          description="Name and contact information shown to clinic users."
          saving={saving === 'branding'}
          onSave={() => save('branding', {
            branding: { name: brandName.trim(), support_email: supportEmail.trim() },
          })}
        >
          <div className="space-y-1.5">
            <Label>Platform Name</Label>
            <Input value={brandName} onChange={e => setBrandName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Support Email</Label>
            <Input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} />
          </div>
        </SettingsSection>

        {/* Broadcast Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Broadcast Templates</CardTitle>
            <CardDescription>Reusable message templates for the Broadcast Center.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {templates.length > 0 && (
              <div className="space-y-2">
                {templates.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeTemplate(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Add Template</p>
              <Input
                placeholder="Template label"
                value={newTplLabel}
                onChange={e => setNewTplLabel(e.target.value)}
              />
              <Textarea
                placeholder="Template body…"
                value={newTplBody}
                onChange={e => setNewTplBody(e.target.value)}
                rows={3}
              />
              <Button size="sm" variant="outline" onClick={addTemplate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Template
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
