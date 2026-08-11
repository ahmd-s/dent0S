'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ToothChart from '@/components/dentos/ToothChart'
import { fmtPatientDate } from '@/lib/patient-clinical'

export default function PatientToothChartPanel({ patientId, readonly = true }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    fetch(`/api/patients/${patientId}/tooth-chart`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  if (!data?.visit_id) {
    return (
      <Card className="p-10 text-center rounded-xl">
        <p className="text-muted-foreground">No tooth chart recorded for this patient yet.</p>
        <p className="text-xs text-muted-foreground mt-2">Charts are created during visits.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing latest chart {data.chart?.last_updated ? `(updated ${fmtPatientDate(data.chart.last_updated)})` : ''}
        </div>
        <Link href={`/visits/${data.visit_id}`}>
          <Button size="sm" variant="outline" className="h-8"><ExternalLink className="w-3.5 h-3.5 mr-1" />Edit in Visit</Button>
        </Link>
      </div>
      <Card className="p-4 rounded-xl overflow-hidden">
        <ToothChart visitId={data.visit_id} patientId={patientId} readOnly={readonly} />
      </Card>
      {data.history?.length > 1 && (
        <Card className="p-4 rounded-xl">
          <h3 className="text-sm font-semibold mb-2">Chart History</h3>
          <div className="space-y-2">
            {data.history.map(h => (
              <Link key={h.visit_id} href={`/visits/${h.visit_id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-sm">
                <span>{fmtPatientDate(h.visit_date)}</span>
                <span className="text-muted-foreground">{h.teeth_count} teeth marked</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
