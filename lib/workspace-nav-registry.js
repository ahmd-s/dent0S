'use client'

import {
  LayoutDashboard,
  Users,
  Calendar,
  Receipt,
  Settings,
  FlaskConical,
  Building2,
  Package,
  Stethoscope,
  BarChart3,
  Sparkles,
  Megaphone,
  CreditCard,
} from 'lucide-react'

/** Navigation registry: workspace key → route + metadata. Order comes from workspace-ui-schema. */
export const NAV_REGISTRY = {
  dashboard: { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  patients: { href: '/patients', label: 'Patients', icon: Users },
  appointments: { href: '/appointments', label: 'Appointments', icon: Calendar },
  visits: { href: '/appointments', label: 'Visits', icon: Stethoscope },
  billing: { href: '/billing', label: 'Billing', icon: Receipt },
  inventory: { href: '/inventory', label: 'Inventory', icon: Package },
  labs: { href: '/lab-cases', label: 'Lab Cases', icon: FlaskConical },
  reports: { href: '/billing', label: 'Reports', icon: BarChart3, note: 'reports via billing' },
  ai: { href: '/dashboard', label: 'AI', icon: Sparkles, note: 'ai tools on dashboard' },
  vendors: { href: '/vendors', label: 'Vendors', icon: Building2 },
  marketing: { href: '/patients', label: 'Marketing', icon: Megaphone, note: 'patient outreach' },
  settings: { href: '/settings', label: 'Settings', icon: Settings },
  subscription: { href: '/subscription', label: 'Subscription', icon: CreditCard },
}

export function resolveNavHref(key) {
  const item = NAV_REGISTRY[key]
  if (!item) return null
  return item.href
}
