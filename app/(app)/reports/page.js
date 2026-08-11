'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import ReportsHub from '@/components/analytics-os/ReportsHub'
import ActivityViewer from '@/components/dentos/ActivityViewer'

function ReportsContent() {
  const params = useSearchParams()
  const section = params.get('section') || 'business'

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#0D9488]" />
          Reports & Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Business Intelligence powered by the Analytics Engine — export CSV, filter by date.
        </p>
      </div>

      <ReportsHub initialSection={section} />

      <ActivityViewer title="Recent clinic activity" limit={20} />
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>}>
      <ReportsContent />
    </Suspense>
  )
}
