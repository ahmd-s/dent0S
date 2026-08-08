'use client'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  Boxes,
  BrainCircuit,
  CalendarClock,
  Camera,
  FileUp,
  FlaskConical,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  PieChart,
  Receipt,
  Smartphone,
  Stethoscope,
  User,
  Users,
  Waves,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SectionHeading } from '@/components/platform-admin/Placeholder'

const FEATURE_GROUPS = [
  {
    title: 'Core',
    features: [
      { id: 'appointments', label: 'Appointments', description: 'Scheduling and calendar', icon: CalendarClock },
      { id: 'billing', label: 'Billing', description: 'Invoices and payments', icon: Receipt },
      { id: 'inventory', label: 'Inventory', description: 'Stock and consumables', icon: Boxes },
      { id: 'labs', label: 'Lab Cases', description: 'Lab cases and portal', icon: FlaskConical },
      { id: 'reports', label: 'Reports', description: 'Analytics and exports', icon: PieChart },
      { id: 'booking', label: 'Online Booking', description: 'Public booking page', icon: Globe },
      { id: 'uploads', label: 'Uploads', description: 'Files and document storage', icon: FileUp },
    ],
  },
  {
    title: 'AI & Advanced',
    features: [
      { id: 'ai', label: 'AI Assistant', description: 'Clinical AI suggestions', icon: BrainCircuit },
      { id: 'analytics', label: 'Analytics', description: 'Advanced analytics dashboard', icon: BarChart3 },
      { id: 'xray_ai', label: 'X-Ray AI', description: 'AI-powered X-ray analysis', icon: Camera },
      { id: 'voice', label: 'Voice', description: 'Voice notes and dictation', icon: Waves },
    ],
  },
  {
    title: 'Communication',
    features: [
      { id: 'whatsapp', label: 'WhatsApp', description: 'Patient messaging via WhatsApp', icon: MessageSquare },
      { id: 'sms', label: 'SMS', description: 'SMS notifications and reminders', icon: Smartphone },
      { id: 'email_notifications', label: 'Email Notifications', description: 'Automated email alerts', icon: Mail },
    ],
  },
  {
    title: 'Portals',
    features: [
      { id: 'patient_portal', label: 'Patient Portal', description: 'Self-service patient portal', icon: User },
      { id: 'doctor_portal', label: 'Doctor Portal', description: 'Doctor-specific interface', icon: Stethoscope },
      { id: 'reception_portal', label: 'Reception Portal', description: 'Reception-specific dashboard', icon: Users },
    ],
  },
  {
    title: 'Access & Integration',
    features: [
      { id: 'api_access', label: 'API Access', description: 'External API integration', icon: KeyRound },
    ],
  },
]

const ALL_DEFAULTS = Object.fromEntries(
  FEATURE_GROUPS.flatMap(g => g.features.map(f => [f.id, false]))
)
// Defaults that are on by default
const DEFAULT_ON = ['appointments', 'billing', 'inventory', 'labs', 'reports', 'booking', 'uploads', 'ai', 'email_notifications']
DEFAULT_ON.forEach(k => { ALL_DEFAULTS[k] = true })

export default function FeaturesSection({ clinic, onClinicUpdate }) {
  const [flags, setFlags] = useState({ ...ALL_DEFAULTS, ...(clinic.features || {}) })
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    setFlags({ ...ALL_DEFAULTS, ...(clinic.features || {}) })
  }, [clinic.features])

  const toggle = async (id, value) => {
    const next = { ...flags, [id]: value }
    setFlags(next)
    setSaving(id)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: next }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error || 'Failed to save feature flag')
        setFlags(prev => ({ ...prev, [id]: !value }))
        return
      }
      const updated = await r.json()
      const label = FEATURE_GROUPS.flatMap(g => g.features).find(f => f.id === id)?.label || id
      toast.success(`${value ? 'Enabled' : 'Disabled'} ${label}`)
      onClinicUpdate({ features: updated.features || next })
    } catch {
      toast.error('Network error')
      setFlags(prev => ({ ...prev, [id]: !value }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Feature Management"
        description="Per-clinic module entitlements. Every toggle is immediately applied and audited."
      />

      {FEATURE_GROUPS.map(group => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 pt-0">
            {group.features.map(f => {
              const Icon = f.icon
              const enabled = flags[f.id] !== false
              const isSaving = saving === f.id

              return (
                <div
                  key={f.id}
                  className={`flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors ${
                    enabled ? 'border-border/70 bg-card' : 'border-border/40 bg-muted/20'
                  }`}
                >
                  <div className="flex min-w-0 gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <Label
                        htmlFor={`feature-${f.id}`}
                        className={`text-sm font-medium ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {f.label}
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
                    </div>
                  </div>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      id={`feature-${f.id}`}
                      checked={enabled}
                      onCheckedChange={v => toggle(f.id, v)}
                      aria-label={`${f.label} toggle`}
                    />
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        Feature flags stored in <code className="rounded bg-muted px-1">clinics.features</code>. Every change is written through the Subscription Engine and audited.
      </p>
    </div>
  )
}
