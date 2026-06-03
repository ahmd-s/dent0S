'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, X, Loader2, Eye, Check, ChevronsUpDown, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'

const CASE_TYPES = ['Crown', 'Bridge', 'Denture', 'Partial Denture', 'Implant Crown', 'Inlay/Onlay', 'Veneer', 'Aligner', 'Night Guard', 'Other']
const MATERIALS = ['Zirconia', 'PFM (Porcelain Fused to Metal)', 'E-max / Lithium Disilicate', 'Full Metal', 'Acrylic', 'Composite', 'Cobalt-Chrome', 'Other']
const URGENCIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
]
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent to Lab' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'received', label: 'Received' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const statusBadge = (s) => {
  const map = {
    pending: 'bg-slate-100 text-slate-700', sent: 'bg-blue-50 text-blue-700',
    in_progress: 'bg-orange-50 text-orange-700', received: 'bg-teal-50 text-teal-700',
    completed: 'bg-green-50 text-green-700', cancelled: 'bg-red-50 text-red-600',
  }
  return <span className={`text-xs px-2 py-1 rounded-full capitalize whitespace-nowrap ${map[s]||'bg-slate-100'}`}>{(s||'').replace('_',' ')}</span>
}
const urgencyBadge = (u) => {
  const map = { routine: 'bg-slate-100 text-slate-600', urgent: 'bg-amber-100 text-amber-700', emergency: 'bg-red-100 text-red-700' }
  return <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${map[u]||'bg-slate-100'}`}>{u||'routine'}</span>
}

function App() {
  const [list, setList] = useState([])
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    const r = await fetch('/api/lab-cases?' + params)
    const d = await r.json()
    setList(d.lab_cases || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [status])

  const visible = useMemo(() => {
    if (!q.trim()) return list
    const re = q.toLowerCase()
    return list.filter(c => [c.case_number, c.patient_name, c.vendor_name, c.case_type].some(x => (x||'').toLowerCase().includes(re)))
  }, [list, q])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><p className="text-muted-foreground text-sm">Track crowns, dentures &amp; lab work across vendors</p></div>
        <Button onClick={()=>setOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>New Lab Case</Button>
      </div>

      <Card className="mt-5 p-4 bg-white border-border rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by case #, patient, vendor…" className="pl-9"/>
          {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground"/></button>}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue/></SelectTrigger>
          <SelectContent>{STATUS_FILTERS.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground whitespace-nowrap">{visible.length} cases</span>
      </Card>

      <Card className="mt-4 bg-white border-border rounded-lg overflow-hidden">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
        {!loading && visible.length === 0 && <div className="py-16 text-center text-muted-foreground text-sm">No lab cases found</div>}
        {!loading && visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-muted-foreground tracking-wider">
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
                  <tr key={c.id} className="border-t border-border hover:bg-[#F8FAFC]/50 cursor-pointer" onClick={()=>window.location.href=`/lab-cases/${c.id}`}>
                    <td className="px-5 py-3 font-medium text-[#0F172A]">{c.case_number}</td>
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

function Combobox({ items, value, onChange, placeholder, emptyText }) {
  const [open, setOpen] = useState(false)
  const selected = items.find(i => i.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder}/>
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map(i => (
                <CommandItem key={i.value} value={i.label} onSelect={()=>{ onChange(i.value); setOpen(false) }}>
                  <Check className={cn('mr-2 h-4 w-4', value === i.value ? 'opacity-100' : 'opacity-0')}/>
                  {i.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const EMPTY = { patient_id: '', vendor_id: '', case_type: '', tooth_numbers: '', shade: '', material: '', description: '', urgency: 'routine', expected_delivery_date: '' }

function NewLabCaseDialog({ open, setOpen, onCreated }) {
  const [f, setF] = useState(EMPTY)
  const [patients, setPatients] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingRefs, setLoadingRefs] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(EMPTY)
    setLoadingRefs(true)
    Promise.all([
      fetch('/api/patients').then(r=>r.json()),
      fetch('/api/vendors').then(r=>r.json()),
    ]).then(([p, v]) => {
      setPatients(p.patients || [])
      setVendors(v.vendors || [])
      setLoadingRefs(false)
    })
  }, [open])

  const patientItems = patients.map(p => ({ value: p.id, label: `${p.name}${p.patient_code?` (${p.patient_code})`:''}${p.phone?` · ${p.phone}`:''}` }))
  const vendorItems = vendors.map(v => ({ value: v.id, label: v.name }))

  const submit = async (e) => {
    e.preventDefault()
    if (!f.patient_id) { toast.error('Please select a patient'); return }
    if (!f.vendor_id) { toast.error('Please select a vendor'); return }
    if (!f.case_type) { toast.error('Please select a case type'); return }
    if (f.expected_delivery_date && isNaN(new Date(f.expected_delivery_date).getTime())) { toast.error('Invalid delivery date'); return }
    setLoading(true)
    const r = await fetch('/api/lab-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { toast.success(`Lab case ${d.case_number} created`); setOpen(false); onCreated && onCreated(); window.location.href = `/lab-cases/${d.id}` }
    else toast.error(d.error || 'Failed to create lab case')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Lab Case</DialogTitle></DialogHeader>
        {loadingRefs ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Patient <span className="text-[#EF4444]">*</span></Label>
              <Combobox items={patientItems} value={f.patient_id} onChange={v=>setF({...f,patient_id:v})} placeholder="Select patient…" emptyText="No patients found"/>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Vendor / Lab <span className="text-[#EF4444]">*</span></Label>
              {vendors.length === 0
                ? <p className="text-xs text-muted-foreground border border-dashed rounded-md p-2.5">No vendors yet. <Link href="/vendors" className="text-[#0D9488] underline">Add a vendor</Link> first.</p>
                : <Combobox items={vendorItems} value={f.vendor_id} onChange={v=>setF({...f,vendor_id:v})} placeholder="Select vendor…" emptyText="No vendors found"/>}
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Case Type <span className="text-[#EF4444]">*</span></Label>
              <Select value={f.case_type} onValueChange={v=>setF({...f,case_type:v})}>
                <SelectTrigger><SelectValue placeholder="Select type"/></SelectTrigger>
                <SelectContent>{CASE_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Tooth Numbers</Label>
              <Input value={f.tooth_numbers} onChange={e=>setF({...f,tooth_numbers:e.target.value})} placeholder="e.g. 11, 12, 21"/>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Shade</Label>
              <Input value={f.shade} onChange={e=>setF({...f,shade:e.target.value})} placeholder="e.g. A2"/>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Material</Label>
              <Select value={f.material} onValueChange={v=>setF({...f,material:v})}>
                <SelectTrigger><SelectValue placeholder="Select material"/></SelectTrigger>
                <SelectContent>{MATERIALS.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Urgency</Label>
              <Select value={f.urgency} onValueChange={v=>setF({...f,urgency:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{URGENCIES.map(u=><SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={f.expected_delivery_date} onChange={e=>setF({...f,expected_delivery_date:e.target.value})}/>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description / Instructions</Label>
              <Textarea rows={3} value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Special instructions for the lab…"/>
            </div>
            <div className="col-span-2 flex justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Create Lab Case'}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default App
