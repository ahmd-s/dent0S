'use client'

import PageHeader from '@/components/dentos/PageHeader'
import ActivityViewer from '@/components/dentos/ActivityViewer'

export default function ActivityPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Activity"
        description="Clinic-wide event stream — appointments, visits, billing, lab, and more."
        backHref="/settings"
        backLabel="Settings"
      />
      <ActivityViewer limit={50} />
    </div>
  )
}
