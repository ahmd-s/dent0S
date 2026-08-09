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

/**
 * Canonical workspace navigation key → route mapping.
 * Order comes from NAVIGATION_FIELDS in workspace-ui-schema.js.
 * Each key must have a unique href (no duplicate targets).
 */
export const NAV_REGISTRY = {
  dashboard: { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  patients: { href: '/patients', label: 'Patients', icon: Users },
  appointments: { href: '/appointments', label: 'Appointments', icon: Calendar },
  visits: { href: '/visits', label: 'Visits', icon: Stethoscope },
  billing: { href: '/billing', label: 'Billing', icon: Receipt },
  inventory: { href: '/inventory', label: 'Inventory', icon: Package },
  labs: { href: '/lab-cases', label: 'Lab Cases', icon: FlaskConical },
  reports: { href: '/reports', label: 'Reports', icon: BarChart3 },
  ai: { href: '/dashboard', label: 'AI', icon: Sparkles },
  vendors: { href: '/vendors', label: 'Vendors', icon: Building2 },
  marketing: { href: '/patients', label: 'Marketing', icon: Megaphone },
  settings: { href: '/settings', label: 'Settings', icon: Settings },
  subscription: { href: '/subscription', label: 'Subscription', icon: CreditCard },
}

/** @deprecated use NAV_REGISTRY[key].href */
export function resolveNavHref(key) {
  return NAV_REGISTRY[key]?.href ?? null
}

/** Validate registry — every listed nav key should resolve to a distinct primary route. */
export function getNavHref(key) {
  return NAV_REGISTRY[key]?.href ?? null
}
