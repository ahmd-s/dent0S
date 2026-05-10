'use client'
import { useEffect, useState } from 'react'
import { Users, Calendar, IndianRupee, TrendingUp, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'

const fmtDate = d => { const x = new Date(d); return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}` }

function App() {
  const [stats, setStats] = useState(null)
  useEffect(() => { fetch('/api/dashboard/stats').then(r=>r.json()).then(setStats) }, [])

  const cards = [
    { label:"Today's Appointments", val: stats?.today_appointments ?? '—', icon: Calendar, color:'#0D9488' },
    { label:'Total Patients', val: stats?.total_patients ?? '—', icon: Users, color:'#3B82F6' },
    { label:"This Month's Revenue", val: stats?.monthly_revenue !== undefined ? `₹${stats.monthly_revenue.toLocaleString('en-IN')}` : '—', icon: IndianRupee, color:'#22C55E' },
    { label:'Pending Invoices', val: stats?.pending_invoices ?? '—', icon: TrendingUp, color:'#F59E0B' },
  ]

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">{fmtDate(new Date())} · Welcome back</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <Card key={c.label} className="p-5 bg-white border-border rounded-lg">
              <div className="flex items-start justify-between">
                <div><div className="text-sm text-muted-foreground">{c.label}</div><div className="text-3xl font-bold mt-2 text-[#0F172A]">{c.val}</div></div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: c.color+'15'}}><Icon className="w-5 h-5" style={{color: c.color}}/></div>
              </div>
            </Card>
          )
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2 p-6 bg-white border-border rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0F172A]">Today&apos;s Schedule</h3>
            <span className="text-xs text-muted-foreground">{stats?.today_list?.length || 0} appointments</span>
          </div>
          {!stats && <div className="text-sm text-muted-foreground">Loading…</div>}
          {stats && stats.today_list?.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">No appointments scheduled today</div>}
          {stats?.today_list?.map(a => (
            <div key={a.id} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
              <div className="w-16 text-sm font-medium text-[#0D9488] flex items-center gap-1"><Clock className="w-3 h-3"/>{a.appointment_time}</div>
              <div className="flex-1">
                <div className="font-medium text-sm">{a.patient_name || a.patient_name_temp}</div>
                <div className="text-xs text-muted-foreground">{a.appointment_type?.replace('_',' ')} · {a.chief_complaint || '—'}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full capitalize ${a.status==='completed'?'bg-green-50 text-green-700':a.status==='cancelled'?'bg-red-50 text-red-600':'bg-[#0D9488]/10 text-[#0D9488]'}`}>{a.status?.replace('_',' ')}</span>
            </div>
          ))}
        </Card>
        <Card className="p-6 bg-white border-border rounded-lg">
          <h3 className="font-semibold text-[#0F172A] mb-4">Recent Patients</h3>
          {stats?.recent_patients?.length === 0 && <div className="text-sm text-muted-foreground py-4">No patients yet</div>}
          {stats?.recent_patients?.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <div className="w-9 h-9 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-semibold text-[#0D9488]">{p.name?.[0]?.toUpperCase()}</div>
              <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
export default App
