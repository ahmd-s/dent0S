'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const fmtDate = d => {
  if (!d) return '—'
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}

export default function VisitsPage() {
  const router = useRouter()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/visits')
      .then(r => r.json())
      .then(d => setVisits(d.visits || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">Visits</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Clinical visits across all patients</p>
      </div>

      {visits.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground bg-card border-border rounded-lg">
          No visits recorded yet.
        </Card>
      ) : (
        <Card className="bg-card border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Doctor</th>
                  <th className="px-4 py-3 font-medium">Chief complaint</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id} className="border-t border-border hover:bg-muted/50">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(v.visit_date)}</td>
                    <td className="px-4 py-3">
                      {v.patient_id ? (
                        <Link href={`/patients/${v.patient_id}`} className="font-medium hover:text-[#0D9488]">
                          View patient
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{v.doctor_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{v.chief_complaint || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" className="h-8" onClick={() => router.push(`/visits/${v.id}`)}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
