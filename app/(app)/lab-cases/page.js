'use client'

import { Suspense, useState } from 'react'
import { Loader2, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-muted-foreground text-sm">Lab Operating System — track cases, vendors &amp; deliveries</p>
        <div className="flex bg-muted border border-border rounded-md p-0.5">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-2.5 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${view === v.id ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {v.id === 'workflow' && <LayoutGrid className="w-3 h-3" />}
              {v.id === 'list' && <List className="w-3 h-3" />}
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
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>}>
      <App />
    </Suspense>
  )
}
