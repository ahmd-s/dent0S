'use client'

import { Suspense, useState } from 'react'
import { Loader2 } from 'lucide-react'
import LabWorkflowDashboard from '@/components/lab-os/LabWorkflowDashboard'
import DoctorLabDashboard from '@/components/lab-os/DoctorLabDashboard'
import ReceptionLabDashboard from '@/components/lab-os/ReceptionLabDashboard'
import { useRole } from '@/components/dentos/RoleContext'
import LegacyLabList from './LegacyLabList'

const VIEWS = [
  { id: 'workflow', label: 'Workflow' },
  { id: 'doctor', label: 'Doctor' },
  { id: 'reception', label: 'Reception' },
  { id: 'list', label: 'List' },
]

function App() {
  const { isDoctor, isReceptionist } = useRole()
  const defaultView = isDoctor() && !isReceptionist() ? 'doctor' : isReceptionist() ? 'reception' : 'workflow'
  const [view, setView] = useState(defaultView)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex bg-muted/70 rounded-lg p-0.5">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${view === v.id ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'workflow' && <LabWorkflowDashboard />}
      {view === 'doctor' && <DoctorLabDashboard />}
      {view === 'reception' && <ReceptionLabDashboard />}
      {view === 'list' && <LegacyLabList />}
    </div>
  )
}

export default function LabCasesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <App />
    </Suspense>
  )
}
