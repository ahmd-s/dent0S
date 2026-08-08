'use client'
import {
  BarChart3,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  ToggleRight,
  Users,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const CLINIC_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'payments', label: 'Payments', icon: Receipt },
  { id: 'timeline', label: 'Timeline', icon: GitBranch },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'features', label: 'Features', icon: ToggleRight },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { id: 'audit', label: 'Audit', icon: ScrollText },
  { id: 'support', label: 'Support', icon: LifeBuoy },
]

export function ClinicSectionNav({ active, onChange }) {
  return (
    <>
      <div className="lg:hidden">
        <Select value={active} onValueChange={onChange}>
          <SelectTrigger aria-label="Select section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLINIC_SECTIONS.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav className="hidden lg:sticky lg:top-24 lg:block lg:self-start" aria-label="Clinic sections">
        <ul className="space-y-0.5">
          {CLINIC_SECTIONS.map(s => {
            const Icon = s.icon
            const isActive = s.id === active
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onChange(s.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
