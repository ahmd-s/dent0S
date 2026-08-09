'use client'

import Link from 'next/link'
import { BarChart3, Receipt, Package, LayoutDashboard } from 'lucide-react'
import { Card } from '@/components/ui/card'

const REPORT_LINKS = [
  {
    href: '/billing',
    label: 'Billing & Revenue',
    description: 'Invoices, collections, and payment status',
    icon: Receipt,
  },
  {
    href: '/inventory',
    label: 'Inventory Analytics',
    description: 'Stock value, consumption, and alerts',
    icon: Package,
  },
  {
    href: '/dashboard',
    label: 'Clinic Dashboard',
    description: 'Daily queue, follow-ups, and operational metrics',
    icon: LayoutDashboard,
  },
]

export default function ReportsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#0D9488]" />
          Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Clinic reporting and analytics
        </p>
      </div>

      <div className="space-y-3">
        {REPORT_LINKS.map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Card className="p-4 bg-card border-border rounded-lg hover:border-[#0D9488]/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#0D9488]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#0D9488]" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{item.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{item.description}</div>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
