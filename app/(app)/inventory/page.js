'use client'

import { Suspense, useState } from 'react'
import { Loader2 } from 'lucide-react'
import InventoryDashboard from '@/components/inventory-os/InventoryDashboard'
import DoctorInventoryDashboard from '@/components/inventory-os/DoctorInventoryDashboard'
import ReceptionInventoryDashboard from '@/components/inventory-os/ReceptionInventoryDashboard'

const VIEWS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'doctor', label: 'Doctor' },
  { id: 'reception', label: 'Reception' },
  { id: 'legacy', label: 'More' },
]

function LegacyAnalytics() {
  return (
    <div className="text-sm text-muted-foreground">
      <p>Items, templates, movements, and alerts.</p>
      <div className="flex flex-wrap gap-2 mt-4">
        {[
          { href: '/inventory/items', label: 'Items' },
          { href: '/inventory/templates', label: 'Templates' },
          { href: '/inventory/movements', label: 'Movements' },
          { href: '/inventory/alerts', label: 'Alerts' },
        ].map(l => (
          <a key={l.href} href={l.href} className="px-3 py-1.5 rounded-md border border-border/70 hover:bg-muted text-xs">
            {l.label}
          </a>
        ))}
      </div>
    </div>
  )
}

function App() {
  const [view, setView] = useState('dashboard')

  return (
    <div className="max-w-7xl mx-auto space-y-5">
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

      {view === 'dashboard' && <InventoryDashboard />}
      {view === 'doctor' && <DoctorInventoryDashboard />}
      {view === 'reception' && <ReceptionInventoryDashboard />}
      {view === 'legacy' && <LegacyAnalytics />}
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <App />
    </Suspense>
  )
}
