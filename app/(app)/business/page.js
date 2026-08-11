'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import ExecutiveDashboard from '@/components/analytics-os/ExecutiveDashboard'

export default function BusinessPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>}>
      <div className="max-w-7xl mx-auto">
        <ExecutiveDashboard />
      </div>
    </Suspense>
  )
}
