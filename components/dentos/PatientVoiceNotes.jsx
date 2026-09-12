'use client'

import { useCallback, useMemo, useState } from 'react'
import { FilePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VisitVoiceRecorder } from '@/components/dentos/VisitVoiceRecorder'
import { toast } from 'sonner'
import { applyVoiceFieldsToVisit, latestOpenVisit } from '@/lib/visit-notes'

/**
 * Patient-page voice notes: record into the latest open visit (or start one).
 * Notes are saved on the visit immediately so they show up after Open.
 */
export default function PatientVoiceNotes({ patientId, visits = [], onUpdated, canRecord }) {
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const openVisit = useMemo(() => latestOpenVisit(visits), [visits])

  const persist = useCallback(async ({ fields }) => {
    if (!openVisit?.id) return
    setSaving(true)
    const merged = applyVoiceFieldsToVisit(openVisit, fields)
    try {
      const r = await fetch(`/api/visits/${openVisit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(d.error || 'Voice notes transcribed but could not be saved on the visit. Open the visit and save them.')
        return
      }
      onUpdated?.()
    } catch {
      toast.error('Voice notes transcribed but the save failed. Check your connection and open the visit.')
    } finally {
      setSaving(false)
    }
  }, [openVisit, onUpdated])

  const startVisit = async () => {
    setCreating(true)
    const r = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, chief_complaint: '' }),
    })
    const d = await r.json().catch(() => ({}))
    setCreating(false)
    if (!r.ok) {
      toast.error(d.error || 'Could not start a visit for voice notes.')
      return
    }
    toast.success('Visit started. Record your notes below.')
    onUpdated?.()
  }

  if (!canRecord) return null

  if (!openVisit) {
    return (
      <div className="mb-4 p-4 rounded-lg border border-dashed border-border bg-muted/40">
        <div className="text-sm font-medium">Voice notes</div>
        <p className="text-xs text-muted-foreground mt-1">Start a visit to record dictation into the clinical notes.</p>
        <Button type="button" size="sm" className="mt-3 bg-[#0D9488] hover:bg-[#0B7E73]" onClick={startVisit} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FilePlus className="w-4 h-4 mr-2" />}
          Start Visit to Record
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs text-muted-foreground">
        Recording into the open visit from {openVisit.visit_date || 'today'}. Review notes on the visit before completing.
      </p>
      <VisitVoiceRecorder visitId={openVisit.id} disabled={saving} onApplyExtraction={persist} />
    </div>
  )
}
