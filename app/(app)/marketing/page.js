'use client'

import { Megaphone } from 'lucide-react'
import ModuleComingSoon from '@/components/dentos/ModuleComingSoon'

export default function MarketingPage() {
  return (
    <ModuleComingSoon
      title="Marketing"
      description="Patient outreach and campaign tools will be available here."
      icon={Megaphone}
    />
  )
}
