'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle, CreditCard, FlaskConical, Pill, Stethoscope } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function DoctorCopilotPanel({ patientId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) return
    fetch(`/api/ai/copilot?patient_id=${patientId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [patientId])

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#0D9488]" /></div>
  if (!data?.ok) return <p className="text-sm text-muted-foreground">Unable to load copilot.</p>

  const s = data.snapshot

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground italic">{data.disclaimer}</p>

      <div className="grid sm:grid-cols-2 gap-3">
        {s.allergies && (
          <Card className="p-3 border-red-200 bg-red-50/30">
            <div className="flex items-center gap-2 text-sm font-medium text-red-700"><AlertTriangle className="w-4 h-4" />Allergies</div>
            <p className="text-xs mt-1">{s.allergies}</p>
          </Card>
        )}
        {s.pending_payments > 0 && (
          <Card className="p-3 border-amber-200 bg-amber-50/30">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700"><CreditCard className="w-4 h-4" />Pending Payment</div>
            <p className="text-xs mt-1">₹{s.pending_payments.toLocaleString('en-IN')} outstanding</p>
          </Card>
        )}
      </div>

      {s.medical_alerts?.length > 0 && (
        <Card className="p-3 border-border">
          <div className="text-sm font-medium mb-2">Medical Alerts</div>
          {s.medical_alerts.map((a, i) => (
            <div key={i} className="text-xs text-muted-foreground">{a.label}: {a.text}</div>
          ))}
        </Card>
      )}

      {s.lab_status?.length > 0 && (
        <Card className="p-3 border-border">
          <div className="flex items-center gap-2 text-sm font-medium mb-2"><FlaskConical className="w-4 h-4" />Lab Status</div>
          {s.lab_status.map((l, i) => (
            <div key={i} className="text-xs flex justify-between"><span>{l.case_number}</span><span className="capitalize">{l.status}</span></div>
          ))}
        </Card>
      )}

      {s.previous_prescriptions?.length > 0 && (
        <Card className="p-3 border-border">
          <div className="flex items-center gap-2 text-sm font-medium mb-2"><Pill className="w-4 h-4" />Recent Prescriptions</div>
          {s.previous_prescriptions.slice(0, 5).map((rx, i) => (
            <div key={i} className="text-xs">{rx.medicine_name} — {rx.dosage} {rx.frequency}</div>
          ))}
        </Card>
      )}

      {s.recommended_sequence && (
        <Card className="p-3 border-border border-dashed">
          <div className="flex items-center gap-2 text-sm font-medium mb-2"><Stethoscope className="w-4 h-4" />Suggested Treatment Sequence</div>
          <p className="text-xs whitespace-pre-line">{s.recommended_sequence}</p>
        </Card>
      )}
    </div>
  )
}
