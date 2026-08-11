'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ActivityViewer from '@/components/dentos/ActivityViewer'

export default function ActivityPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Settings
      </Link>
      <h1 className="text-xl font-semibold tracking-tight mb-1">Activity</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Clinic-wide event stream — appointments, visits, billing, lab, and more.
      </p>
      <ActivityViewer limit={50} />
    </div>
  )
}
