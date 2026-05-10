'use client'
import { useEffect, useState } from 'react'
import { Plus, Search, Phone, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const fmt = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'

function App() {
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState({ name:'', phone:'', age:'', gender:'', blood_group:'', allergies:'', medical_history:'', address:'', referral_source:'' })

  const load = async () => {
    const r = await fetch('/api/patients' + (q?`?q=${encodeURIComponent(q)}`:''))
    const d = await r.json()
    setList(d.patients || [])
  }
  useEffect(() => { load() }, [q])

  const submit = async e => {
    e.preventDefault()
    if (!f.name || !f.phone) { toast.error('Name and phone required'); return }
    if (!/^\d{10}$/.test(f.phone)) { toast.error('Phone must be 10 digits'); return }
    setLoading(true)
    const r = await fetch('/api/patients', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...f, age: f.age?parseInt(f.age):null }) })
    setLoading(false)
    if (r.ok) { toast.success('Patient added'); setOpen(false); setF({ name:'', phone:'', age:'', gender:'', blood_group:'', allergies:'', medical_history:'', address:'', referral_source:'' }); load() }
    else toast.error('Failed')
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[#0F172A]">Patients</h1><p className="text-muted-foreground text-sm mt-1">{list.length} total</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Patient</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Patient</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-1.5"><Label>Full Name *</Label><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></div>
              <div className="space-y-1.5"><Label>Phone (10 digits) *</Label><Input value={f.phone} onChange={e=>setF({...f,phone:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="9876543210"/></div>
              <div className="space-y-1.5"><Label>Age</Label><Input type="number" value={f.age} onChange={e=>setF({...f,age:e.target.value})}/></div>
              <div className="space-y-1.5"><Label>Gender</Label>
                <Select value={f.gender} onValueChange={v=>setF({...f,gender:v})}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Blood Group</Label>
                <Select value={f.blood_group} onValueChange={v=>setF({...f,blood_group:v})}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Referral</Label><Input value={f.referral_source} onChange={e=>setF({...f,referral_source:e.target.value})}/></div>
              <div className="col-span-2 space-y-1.5"><Label>Address</Label><Input value={f.address} onChange={e=>setF({...f,address:e.target.value})}/></div>
              <div className="col-span-2 space-y-1.5"><Label>Allergies</Label><Input value={f.allergies} onChange={e=>setF({...f,allergies:e.target.value})}/></div>
              <div className="col-span-2 space-y-1.5"><Label>Medical History</Label><Textarea rows={2} value={f.medical_history} onChange={e=>setF({...f,medical_history:e.target.value})}/></div>
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Save Patient'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-6 mb-4 relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
        <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or phone…" className="pl-9"/>
        {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground"/></button>}
      </div>
      <Card className="bg-white border-border rounded-lg overflow-hidden">
        {list.length===0 && <div className="py-12 text-center text-muted-foreground text-sm">No patients yet. Add your first patient.</div>}
        {list.length>0 && (
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-muted-foreground tracking-wider">
              <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Age/Gender</th><th className="px-5 py-3">Last Visit</th><th className="px-5 py-3">Visits</th></tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-[#F8FAFC]/50">
                  <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-semibold text-[#0D9488]">{p.name?.[0]?.toUpperCase()}</div><div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.patient_code || p.id.slice(0,8)}</div></div></div></td>
                  <td className="px-5 py-3"><div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3 h-3"/>+91 {p.phone}</div></td>
                  <td className="px-5 py-3 text-muted-foreground">{p.age||'—'} {p.gender? `· ${p.gender}` : ''}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmt(p.last_visit_date)}</td>
                  <td className="px-5 py-3"><span className="text-xs px-2 py-1 rounded-full bg-muted">{p.total_visits || 0}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
export default App
