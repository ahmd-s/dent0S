'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'

export default function PatientInternalRemarks({ patient, onSaved, readonly = false }) {
  const [notes, setNotes] = useState(patient?.internal_remarks || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const r = await fetch(`/api/patients/${patient.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ internal_remarks: notes }),
    })
    setSaving(false)
    if (r.ok) { toast.success('Notes saved'); onSaved?.() }
    else toast.error('Failed to save')
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
        <h3 className="font-semibold mb-1">Internal Remarks</h3>
        <p className="text-xs text-muted-foreground mb-3">Staff-only notes — not visible to patients.</p>
        <Textarea rows={5} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add internal notes…" disabled={readonly} />
        {!readonly && (
          <div className="flex justify-end mt-3">
            <Button onClick={save} disabled={saving} className="bg-[#0D9488] hover:bg-[#0B7E73]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Notes'}
            </Button>
          </div>
        )}
      </Card>
    </PatientSectionGate>
  )
}
