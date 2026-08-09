'use client'

import { Sparkles } from 'lucide-react'
import ModuleComingSoon from '@/components/dentos/ModuleComingSoon'

export default function AiPage() {
  return (
    <ModuleComingSoon
      title="AI"
      description="AI-assisted clinical and operational tools will be available here."
      icon={Sparkles}
    />
  )
}
