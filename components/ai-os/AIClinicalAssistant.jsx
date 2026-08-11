'use client'

import { useEffect, useState } from 'react'
import { Loader2, Lightbulb, Calendar, AlertTriangle, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function AIClinicalAssistant({ patient, visits = [], readonly = false }) {
  const [treatment, setTreatment] = useState(null)
  const [followup, setFollowup] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const [loading, setLoading] = useState(null)

  const fetchSuggestion = async (action, setter) => {
    setLoading(action)
    const r = await fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, patient_id: patient.id }),
    })
    const d = await r.json()
    setLoading(null)
    if (r.ok) setter(d)
    else toast.error(d.error || 'Failed')
  }

  const riskIndicators = []
  if (patient?.allergies) riskIndicators.push({ label: 'Allergies', severity: 'high' })
  if (patient?.medical_history) riskIndicators.push({ label: 'Medical History', severity: 'medium' })
  const pendingPlans = visits.filter(v => v.treatment_plan && !v.treatment_done).length
  if (pendingPlans > 0) riskIndicators.push({ label: `${pendingPlans} pending treatment(s)`, severity: 'medium' })

  return (
    <div className="space-y-3">
      {riskIndicators.length > 0 && (
        <Card className="p-3 border-amber-200 bg-amber-50/20">
          <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="w-4 h-4 text-amber-600" />Risk Indicators</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {riskIndicators.map((r, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">{r.label}</span>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-3 border-border">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Outstanding Treatment</div>
          <span className="text-xs text-muted-foreground">{pendingPlans} pending</span>
        </div>
        {visits.filter(v => v.treatment_plan && !v.treatment_done).slice(0, 3).map(v => (
          <p key={v.id} className="text-xs text-muted-foreground mt-1">{v.visit_date}: {v.treatment_plan}</p>
        ))}
      </Card>

      {!readonly && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!!loading} onClick={() => fetchSuggestion('treatment', setTreatment)}>
            {loading === 'treatment' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3 mr-1" />}Suggest Treatment
          </Button>
          <Button size="sm" variant="outline" disabled={!!loading} onClick={() => fetchSuggestion('followup', setFollowup)}>
            {loading === 'followup' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3 mr-1" />}Suggest Follow-up
          </Button>
          <Button size="sm" variant="outline" disabled={!!loading} onClick={() => fetchSuggestion('explain', setExplanation)}>
            {loading === 'explain' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Patient Education
          </Button>
        </div>
      )}

      {treatment?.suggestions && (
        <Card className="p-3 border-border border-dashed">
          <div className="text-xs font-medium text-muted-foreground mb-1">Suggested Next Treatment</div>
          <p className="text-sm whitespace-pre-line">{treatment.suggestions}</p>
          <p className="text-[10px] text-muted-foreground mt-2 italic">{treatment.disclaimer}</p>
        </Card>
      )}

      {followup?.suggested_action && (
        <Card className="p-3 border-border border-dashed">
          <div className="text-xs font-medium text-muted-foreground mb-1">Follow-up Suggestion</div>
          <p className="text-sm">{followup.suggested_action}</p>
          {followup.next_followup_date && <p className="text-xs text-muted-foreground mt-1">Due: {followup.next_followup_date}</p>}
        </Card>
      )}

      {explanation?.explanation && (
        <Card className="p-3 border-border border-dashed">
          <div className="text-xs font-medium text-muted-foreground mb-1">Patient Education {explanation.printable && '(Printable)'}</div>
          <p className="text-sm whitespace-pre-line">{explanation.explanation}</p>
        </Card>
      )}
    </div>
  )
}
