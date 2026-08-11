'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export default function DoctorPerformancePanel({ doctors = [], leaderboard = [] }) {
  if (!doctors.length) return null

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Doctor Performance
        </h3>
        <Link href="/reports?section=doctors" className="text-xs text-[#0D9488] hover:underline">Full report</Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="pb-2 pr-4">Doctor</th>
              <th className="pb-2 pr-4">Revenue</th>
              <th className="pb-2 pr-4">Patients</th>
              <th className="pb-2 pr-4">Appts</th>
              <th className="pb-2 pr-4">Efficiency</th>
              <th className="pb-2">Productivity</th>
            </tr>
          </thead>
          <tbody>
            {doctors.slice(0, 8).map((d, i) => (
              <tr key={d.doctor_id} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 pr-4 font-medium">
                  {i < 3 && <span className="text-amber-500 mr-1">#{i + 1}</span>}
                  {d.name}
                </td>
                <td className="py-2.5 pr-4 tabular-nums">{inr(d.revenue)}</td>
                <td className="py-2.5 pr-4">{d.patients_handled}</td>
                <td className="py-2.5 pr-4">{d.appointments}</td>
                <td className="py-2.5 pr-4">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${d.efficiency_score >= 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {d.efficiency_score}%
                  </span>
                </td>
                <td className="py-2.5 tabular-nums">{d.productivity_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
