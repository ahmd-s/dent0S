'use client'

import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function SmartInsightsPanel({ insights = [] }) {
  if (!insights.length) return null

  return (
    <Card className="p-4 md:p-5 bg-gradient-to-br from-[#0D9488]/5 to-indigo-500/5 border-[#0D9488]/20">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#0D9488]" />
        Smart Insights
        <span className="text-[10px] font-normal text-muted-foreground ml-1">Rule-based · No AI</span>
      </h3>
      <ul className="space-y-2">
        {insights.map((text, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] mt-1.5 flex-shrink-0" />
            {text}
          </li>
        ))}
      </ul>
    </Card>
  )
}
