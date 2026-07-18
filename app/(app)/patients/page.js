'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Phone, Search, Eye, CalendarPlus, X, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'
import ImportPatientsModal from '@/components/dentos/ImportPatientsModal'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'
const PAGE_SIZE = 20

function App() {
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const { canAccessClinical } = useRole()
  const canImport = canAccessClinical()

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (filter !== 'all') params.set('filter', filter)
    const r = await fetch('/api/patients?' + params)
    const d = await r.json()
    setList(d.patients || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [q, filter])

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const visible = list.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><p className="text-muted-foreground text-sm">Manage all patients in your clinic</p></div>
        {canImport && (
          <div className="flex gap-2">
            <ImportPatientsModal 
              open={importModalOpen} 
              onOpenChange={setImportModalOpen} 
              onImportComplete={load} 
            />
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => setImportModalOpen(true)}
            >
              <Upload className="w-4 h-4" />
              Import Patients
            </Button>
            <AddPatientButton onCreated={load} open={open} setOpen={setOpen} />
          </div>
        )}
      </div>
      <Card className="mt-5 p-4 bg-card border-border rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or phone…" className="pl-9"/>
          {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground"/></button>}
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Patients</SelectItem>
            <SelectItem value="week">Visited This Week</SelectItem>
            <SelectItem value="month">Visited This Month</SelectItem>
            <SelectItem value="inactive">Not Visited in 3 Months</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground whitespace-nowrap">{list.length} patients</span>
      </Card>
      <Card className="mt-4 bg-card border-border rounded-lg overflow-hidden">
        {loading && (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-9 h-9 rounded-full bg-muted animate-pulse"/>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3 animate-pulse"/>
                  <div className="h-3 bg-muted rounded w-1/4 animate-pulse"/>
                </div>
                <div className="h-4 bg-muted rounded w-16 animate-pulse"/>
                <div className="h-4 bg-muted rounded w-12 animate-pulse"/>
                <div className="h-4 bg-muted rounded w-20 animate-pulse"/>
                <div className="h-4 bg-muted rounded w-24 animate-pulse"/>
                <div className="h-8 bg-muted rounded w-20 animate-pulse"/>
              </div>
            ))}
          </div>
        )}
        {!loading && visible.length===0 && <div className="py-16 text-center text-muted-foreground text-sm">No patients match your search</div>}
        {!loading && visible.length>0 && (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase text-muted-foreground tracking-wider">
                  <tr><th className="px-5 py-3 font-medium">Name</th><th className="px-5 py-3 font-medium">Phone</th><th className="px-5 py-3 font-medium">Age</th><th className="px-5 py-3 font-medium">Gender</th><th className="px-5 py-3 font-medium">Last Visit</th><th className="px-5 py-3 font-medium">Follow-up Due</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr>
                </thead>
                <tbody>
                  {visible.map(p => {
                    const fudate = p.next_followup_date ? new Date(p.next_followup_date) : null
                    const overdue = fudate && fudate < new Date()
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/50 cursor-pointer" onClick={()=>window.location.href=`/patients/${p.id}`}>
                        <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-semibold text-[#0D9488]">{p.name?.[0]?.toUpperCase()}</div><div><div className="font-medium text-foreground">{p.name}</div><div className="text-xs text-muted-foreground">{p.patient_code}</div></div></div></td>
                        <td className="px-5 py-3 text-muted-foreground"><div className="flex items-center gap-1.5"><Phone className="w-3 h-3"/>+91 {p.phone}</div></td>
                        <td className="px-5 py-3 text-muted-foreground">{p.age||'—'}</td>
                        <td className="px-5 py-3 text-muted-foreground capitalize">{p.gender||'—'}</td>
                        <td className="px-5 py-3 text-muted-foreground">{fmtDate(p.last_visit_date)}</td>
                        <td className="px-5 py-3">{fudate ? <span className={overdue?'text-[#EF4444] font-medium':'text-success font-medium'}>{fmtDate(p.next_followup_date)}</span> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-5 py-3" onClick={e=>e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Link href={`/patients/${p.id}`}><Button size="sm" variant="outline" className="h-8"><Eye className="w-3.5 h-3.5 mr-1"/>View</Button></Link>
                            <Link href={`/appointments?patient=${p.id}`}><Button size="sm" className="h-8 bg-[#0D9488] hover:bg-[#0B7E73]"><CalendarPlus className="w-3.5 h-3.5 mr-1"/>Book</Button></Link>
                            <Button
              size="sm"
              variant="destructive"
              onClick={async (e) => {
                e.stopPropagation()
                const ok = confirm('Delete this patient permanently?')
                if (!ok) return
                const r = await fetch(`/api/patients/${p.id}`, { method: 'DELETE' })
                if (r.ok) {
                  toast.success('Patient deleted')
                  load()
                } else {
                  toast.error('Failed to delete patient')
                }
              }}
            >
              Delete
            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-4">
              {visible.map(p => {
                const fudate = p.next_followup_date ? new Date(p.next_followup_date) : null
                const overdue = fudate && fudate < new Date()
                return (
                  <div key={p.id} className="border border-border rounded-lg p-4 bg-card">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-semibold text-[#0D9488] flex-shrink-0">{p.name?.[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/patients/${p.id}`} className="font-medium text-foreground hover:text-[#0D9488] block truncate">{p.name}</Link>
                        <div className="text-xs text-muted-foreground">{p.patient_code}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"><Phone className="w-3 h-3"/>+91 {p.phone}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div><span className="text-muted-foreground">Age:</span> {p.age||'—'}</div>
                      <div><span className="text-muted-foreground">Gender:</span> {p.gender||'—'}</div>
                      <div><span className="text-muted-foreground">Last Visit:</span> {fmtDate(p.last_visit_date)}</div>
                      <div><span className="text-muted-foreground">Follow-up:</span> {fudate ? <span className={overdue?'text-[#EF4444] font-medium':'text-success font-medium'}>{fmtDate(p.next_followup_date)}</span> : '—'}</div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/patients/${p.id}`} className="flex-1"><Button size="sm" variant="outline" className="h-10 w-full"><Eye className="w-3.5 h-3.5 mr-1"/>View</Button></Link>
                      <Link href={`/appointments?patient=${p.id}`} className="flex-1"><Button size="sm" className="h-10 w-full bg-[#0D9488] hover:bg-[#0B7E73]"><CalendarPlus className="w-3.5 h-3.5 mr-1"/>Book</Button></Link>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async (e) => {
                          e.stopPropagation()
                          const ok = confirm('Delete this patient permanently?')
                          if (!ok) return
                          const r = await fetch(`/api/patients/${p.id}`, { method: 'DELETE' })
                          if (r.ok) {
                            toast.success('Patient deleted')
                            load()
                          } else {
                            toast.error('Failed to delete patient')
                          }
                        }}
                        className="h-10 px-3"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
      {totalPages>1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>Next</Button>
        </div>
      )}
    </div>
  )
}

function AddPatientButton({ onCreated, open, setOpen }) {
  const [f, setF] = useState({ name:'', phone:'', dob:'', age:'', gender:'', blood_group:'', allergies:'', medical_history:'', address:'', referral_source:'' })
  const [loading, setLoading] = useState(false)
  const reset = () => setF({ name:'', phone:'', dob:'', age:'', gender:'', blood_group:'', allergies:'', medical_history:'', address:'', referral_source:'' })

  const onDob = v => {
    let age = f.age
    if (v) { const dob = new Date(v); const t = new Date(); age = String(t.getFullYear() - dob.getFullYear() - (t < new Date(t.getFullYear(), dob.getMonth(), dob.getDate())?1:0)) }
    setF({...f, dob: v, age })
  }

  const submit = async e => {
    e.preventDefault()
    if (!f.name || !f.phone) { toast.error('Name and phone required'); return }
    if (!/^\d{10}$/.test(f.phone)) { toast.error('Phone must be 10 digits'); return }
    setLoading(true)
    const r = await fetch('/api/patients', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...f, age: f.age?parseInt(f.age):null }) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { toast.success('Patient added'); reset(); setOpen(false); onCreated && onCreated(); window.location.href = `/patients/${d.id}` }
    else toast.error(d.error||'Failed')
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Patient</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add New Patient</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2"><Label>Full Name <span className="text-[#EF4444]">*</span></Label><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})} autoFocus/></div>
          <div className="space-y-1.5"><Label>Phone <span className="text-[#EF4444]">*</span></Label>
            <div className="flex"><span className="px-3 flex items-center bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">+91</span>
              <Input value={f.phone} onChange={e=>setF({...f,phone:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="9876543210" className="rounded-l-none"/></div></div>
          <div className="space-y-1.5"><Label>Date of Birth</Label><Input type="date" value={f.dob} onChange={e=>onDob(e.target.value)}/></div>
          <div className="space-y-1.5"><Label>Age</Label><Input type="number" value={f.age} onChange={e=>setF({...f,age:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>Gender</Label><Select value={f.gender} onValueChange={v=>setF({...f,gender:v})}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5 col-span-2"><Label>Blood Group</Label><Select value={f.blood_group} onValueChange={v=>setF({...f,blood_group:v})}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5 col-span-2"><Label className="text-[#EF4444]">Allergies <span className="text-xs font-normal">(important for treatment)</span></Label><Textarea rows={2} value={f.allergies} onChange={e=>setF({...f,allergies:e.target.value})}/></div>
          <div className="space-y-1.5 col-span-2"><Label>Medical History</Label><Textarea rows={2} value={f.medical_history} onChange={e=>setF({...f,medical_history:e.target.value})}/></div>
          <div className="space-y-1.5 col-span-2"><Label>Address</Label><Textarea rows={2} value={f.address} onChange={e=>setF({...f,address:e.target.value})}/></div>
          <div className="space-y-1.5 col-span-2"><Label>Referral Source</Label><Input value={f.referral_source} onChange={e=>setF({...f,referral_source:e.target.value})} placeholder="e.g. Google, Friend referral"/></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Save Patient'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
