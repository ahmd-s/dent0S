'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, Loader2, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'

export default function PatientAIWorkspace({ patient, visits = [], onUpdated, readonly = false }) {
  const [summary, setSummary] = useState(patient?.ai_summary || '')
  const [genAt, setGenAt] = useState(patient?.ai_summary_generated_at || null)
  const [loading, setLoading] = useState(false)

  const lastVisitDate = visits[0]?.visit_date || null
  const isStale = !genAt || (lastVisitDate && new Date(genAt) < new Date(lastVisitDate))
  const fmt = d => d ? new Date(d).toLocaleDateString('en-IN') : ''

  const generate = async () => {
    if (readonly) return
    setLoading(true)
    const r = await fetch('/api/generate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patient.id }),
    })
    const d = await r.json()
    setLoading(false)
    if (r.ok) {
      setSummary(d.summary)
      setGenAt(d.generated_at)
      toast.success('Summary generated')
      onUpdated?.()
    } else toast.error(d.error || 'Failed to generate')
  }

  const readOnlyContent = summary ? (
    <Card className="p-6 bg-blue-50/40 border-blue-200 rounded-xl">
      <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-[#0D9488]" /><h3 className="font-semibold">AI Clinical Summary</h3></div>
      <div className="text-sm whitespace-pre-line">{summary}</div>
      <p className="text-xs text-muted-foreground mt-3 italic">Read-only view · Generated {fmt(genAt)}</p>
    </Card>
  ) : (
    <Card className="p-8 text-center text-muted-foreground rounded-xl">No AI summary generated yet.</Card>
  )

  return (
    <PatientSectionGate flag="ai_summary" readOnlyContent={readonly ? readOnlyContent : null}>
      <div className="space-y-4">
        {visits.length === 0 ? (
          <Card className="p-10 text-center rounded-xl border-dashed">
            <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">Add at least one visit to generate an AI summary</p>
          </Card>
        ) : summary && !isStale ? (
          <Card className="p-6 bg-blue-50/40 border-blue-200 rounded-xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#0D9488]" /><h3 className="font-semibold">AI Clinical Summary</h3></div>
                <p className="text-xs text-muted-foreground mt-0.5">Generated {fmt(genAt)} · Documentation only</p>
              </div>
              {!readonly && (
                <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><RefreshCw className="w-3.5 h-3.5 mr-1" />Regenerate</>}
                </Button>
              )}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-line">{summary}</div>
            <p className="mt-4 pt-3 border-t border-blue-200 text-xs text-muted-foreground italic">
              Generated from doctor&apos;s notes. Documentation assistant only — not medical advice.
            </p>
          </Card>
        ) : (
          <Card className="p-10 text-center rounded-xl border-2 border-dashed">
            <Sparkles className="w-10 h-10 mx-auto text-[#0D9488]" />
            <h3 className="mt-3 font-semibold">{summary ? 'New Visits Since Last Summary' : 'Generate AI Summary'}</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">Summarize treatment history from recorded visits.</p>
            {!readonly && (
              <Button onClick={generate} disabled={loading} className="mt-5 bg-[#0D9488] hover:bg-[#0B7E73]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {summary ? 'Regenerate Summary' : 'Generate Summary'}
              </Button>
            )}
          </Card>
        )}

        <Card className="p-4 rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium"><Mic className="w-4 h-4 text-muted-foreground" />Voice Transcriptions</div>
          <p className="text-xs text-muted-foreground mt-1">Voice notes are captured during visits. Open a visit to record or view transcriptions.</p>
        </Card>
      </div>
    </PatientSectionGate>
  )
}
