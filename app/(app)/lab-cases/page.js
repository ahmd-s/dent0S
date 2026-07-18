'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, X, Loader2, Eye, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NewLabCaseDialog } from '@/components/dentos/NewLabCaseDialog'
import { LAB_CASE_STATUS_META, statusLabel } from '@/lib/lab-case-helpers'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'

// Filters map to one or more underlying statuses. Grouped filters mirror the
// dashboard widgets so a widget can deep-link here via ?status=<key>.
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Awaiting Lab Acceptance' },
  { value: 'lab_received,in_production,in_progress', label: 'In Production' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered to Clinic' },
  { value: 'received', label: 'Received' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'overdue', label: 'Overdue' },
]

const statusBadge = (s) => {
  const cls = LAB_CASE_STATUS_META[s]?.badge || 'bg-slate-100 text-slate-700'
  return <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${cls}`}>{statusLabel(s)}</span>
}
const urgencyBadge = (u) => {
  const map = { routine: 'bg-slate-100 text-slate-600', urgent: 'bg-amber-100 text-amber-700', emergency: 'bg-red-100 text-red-700' }
  return <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${map[u]||'bg-slate-100'}`}>{u||'routine'}</span>
}

function App() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || 'all'
  const [list, setList] = useState([])
  const [status, setStatus] = useState(initialStatus)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    // 'overdue' is a derived flag (not a stored status): fetch all and filter client-side.
    if (status !== 'all' && status !== 'overdue') params.set('status', status)
    const r = await fetch('/api/lab-cases?' + params)
    const d = await r.json()
    setList(d.lab_cases || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [status])

  const visible = useMemo(() => {
    let l = status === 'overdue' ? list.filter(c => c.overdue) : list
    if (!q.trim()) return l
    const re = q.toLowerCase()
    return l.filter(c => [c.case_number, c.patient_name, c.vendor_name, c.case_type].some(x => (x||'').toLowerCase().includes(re)))
  }, [list, q, status])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><p className="text-muted-foreground text-sm">Track crowns, dentures &amp; lab work across vendors</p></div>
        <Button onClick={()=>setOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>New Lab Case</Button>
      </div>

      <Card className="mt-5 p-4 bg-card border-border rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by case #, patient, vendor…" className="pl-9"/>
          {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground"/></button>}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue/></SelectTrigger>
          <SelectContent>{STATUS_FILTERS.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground whitespace-nowrap">{visible.length} cases</span>
      </Card>

      <Card className="mt-4 bg-card border-border rounded-lg overflow-hidden">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
        {!loading && visible.length === 0 && <div className="py-16 text-center text-muted-foreground text-sm">No lab cases found</div>}
        {!loading && visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-medium">Case #</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Urgency</th>
                  <th className="px-5 py-3 font-medium">Expected</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(c => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/50 cursor-pointer" onClick={()=>window.location.href=`/lab-cases/${c.id}`}>
                    <td className="px-5 py-3 font-medium text-foreground">{c.case_number}</td>
                    <td className="px-5 py-3">{c.patient_name}</td>
                    <td className="px-5 py-3">{c.vendor_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.case_type}</td>
                    <td className="px-5 py-3">{urgencyBadge(c.urgency)}</td>
                    <td className="px-5 py-3">
                      {c.expected_delivery_date
                        ? <span className={c.overdue ? 'text-[#EF4444] font-medium flex items-center gap-1' : 'text-muted-foreground'}>{c.overdue && <AlertTriangle className="w-3.5 h-3.5"/>}{fmtDate(c.expected_delivery_date)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-3">{statusBadge(c.status)}</td>
                    <td className="px-5 py-3" onClick={e=>e.stopPropagation()}>
                      <div className="flex justify-end">
                        <Link href={`/lab-cases/${c.id}`}><Button size="sm" variant="outline" className="h-8"><Eye className="w-3.5 h-3.5 mr-1"/>View</Button></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewLabCaseDialog open={open} setOpen={setOpen} onCreated={load} />
    </div>
  )
}

export default function LabCasesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}>
      <App />
    </Suspense>
  )
}
