'use client'

import { useState } from 'react'
import { DocumentsTab } from '@/components/dentos/DocumentsTab'
import { Card } from '@/components/ui/card'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'xray', label: 'X-rays' },
  { id: 'photo', label: 'Photos' },
  { id: 'scan', label: 'Scans' },
  { id: 'pdf', label: 'PDF' },
  { id: 'consent', label: 'Consent' },
  { id: 'prescription', label: 'Prescriptions' },
]

export default function PatientDocumentsPanel({ patientId, readonly = false }) {
  const [category, setCategory] = useState('all')

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${category === c.id ? 'bg-[#0D9488] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Card className="p-4 rounded-xl">
        <DocumentsTab patientId={patientId} categoryFilter={category === 'all' ? null : category} readOnly={readonly} />
      </Card>
    </div>
  )

  return (
    <PatientSectionGate flag="documents" readOnlyContent={readonly ? content : null}>
      {content}
    </PatientSectionGate>
  )
}
