'use client'

import { Suspense, useState } from 'react'
import { Loader2, LayoutGrid, Stethoscope, ClipboardList, List } from 'lucide-react'
import InventoryDashboard from '@/components/inventory-os/InventoryDashboard'
import DoctorInventoryDashboard from '@/components/inventory-os/DoctorInventoryDashboard'
import ReceptionInventoryDashboard from '@/components/inventory-os/ReceptionInventoryDashboard'
import { useRole } from '@/components/dentos/RoleContext'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'doctor', label: 'Doctor' },
  { id: 'reception', label: 'Reception' },
  { id: 'legacy', label: 'Analytics' },
]

function LegacyAnalytics() {
  return (
    <div className="text-sm text-muted-foreground">
      <p>Legacy analytics, items, templates, movements, and alerts remain available via sub-navigation.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {[
          { href: '/inventory/items', label: 'Items' },
          { href: '/inventory/templates', label: 'Templates' },
          { href: '/inventory/movements', label: 'Movements' },
          { href: '/inventory/alerts', label: 'Alerts' },
        ].map(l => (
          <a key={l.href} href={l.href} className="px-3 py-1.5 rounded-md border border-border hover:bg-muted text-xs">
            {l.label}
          </a>
        ))}
      </div>
    </div>
  )
}

function App() {
  const { isDoctor, isReceptionist } = useRole()
  const defaultView = isDoctor() && !isReceptionist() ? 'doctor' : isReceptionist() ? 'reception' : 'dashboard'
  const [view, setView] = useState(defaultView)

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-muted-foreground text-sm">Inventory Intelligence — stock lifecycle, batches, purchases &amp; alerts</p>
        <div className="flex bg-muted border border-border rounded-md p-0.5">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-2.5 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${view === v.id ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {v.id === 'dashboard' && <LayoutGrid className="w-3 h-3" />}
              {v.id === 'doctor' && <Stethoscope className="w-3 h-3" />}
              {v.id === 'reception' && <ClipboardList className="w-3 h-3" />}
              {v.id === 'legacy' && <List className="w-3 h-3" />}
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
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>}>
      <App />
    </Suspense>
  )
}
