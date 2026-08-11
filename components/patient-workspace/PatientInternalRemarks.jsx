'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'
import { useAutosave } from '@/hooks/useAutosave'
import { AUTOSAVE_SCOPES } from '@/lib/autosave-client'
import { AutosaveIndicator } from '@/components/system/AutosaveIndicator'

export default function PatientInternalRemarks({ patient, onSaved, readonly = false }) {
  const [notes, setNotes] = useState(patient?.internal_remarks || '')

  const { status, lastSavedAt, recovered, recoverDraft, dismissRecovery, saveNow } = useAutosave({
    scope: AUTOSAVE_SCOPES.PATIENT_NOTES,
    id: patient?.id,
    value: notes,
    enabled: !readonly && !!patient?.id,
    debounceMs: 3000,
    onSave: async (data) => {
      const r = await fetch(`/api/patients/${patient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internal_remarks: typeof data === 'string' ? data : data?.notes || notes }),
      })
      if (!r.ok) throw new Error('Save failed')
      onSaved?.()
    },
  })

  useEffect(() => {
    if (recovered) {
      const draft = recoverDraft()
      if (draft && typeof draft === 'string' && draft !== notes) {
        // Draft available — user can restore via banner
      }
    }
  }, [recovered, recoverDraft, notes])

  const save = async () => {
    try {
      await saveNow()
      toast.success('Notes saved')
    } catch {
      toast.error('Failed to save')
    }
  }

  const restoreDraft = () => {
    const draft = recoverDraft()
    if (draft) {
      setNotes(typeof draft === 'string' ? draft : draft.notes || '')
      dismissRecovery()
      toast.success('Draft restored')
    }
  }

  const readOnlyView = (
    <Card className="p-5 rounded-xl">
      <h3 className="font-semibold mb-3">Internal Remarks</h3>
      <p className="text-sm whitespace-pre-line text-muted-foreground">{notes || 'No internal notes.'}</p>
    </Card>
  )

  return (
    <PatientSectionGate flag="internal_remarks" readOnlyContent={readonly ? readOnlyView : null}>
      <Card className="p-5 rounded-xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold">Internal Remarks</h3>
          {!readonly && <AutosaveIndicator status={status} lastSavedAt={lastSavedAt} />}
        </div>
        <p className="text-xs text-muted-foreground mb-3">Staff-only notes — not visible to patients.</p>
        {recovered && (
          <div className="mb-3 p-2 rounded-md bg-amber-50 border border-amber-200 text-xs flex items-center justify-between">
            <span>Unsaved draft found from a previous session.</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={restoreDraft}>Restore</Button>
          </div>
        )}
        <Textarea rows={5} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add internal notes…" disabled={readonly} />
        {!readonly && (
          <div className="flex justify-end mt-3">
            <Button onClick={save} disabled={status === 'saving'} className="bg-[#0D9488] hover:bg-[#0B7E73]">
              {status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Notes'}
            </Button>
          </div>
        )}
      </Card>
    </PatientSectionGate>
  )
}
