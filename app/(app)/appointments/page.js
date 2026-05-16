'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, ChevronRight, Loader2, MoreVertical, Phone, Calendar, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

const todayIso = () => new Date().toISOString().slice(0,10)
const fmtFull = d => { const x = new Date(d+'T00:00:00'); return x.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) }
const shiftDate = (iso, days) => { const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10) }
const STATUS = ['scheduled','arrived','in_progress','completed','cancelled','no_show']
const TYPES = ['new_patient','follow_up','emergency','consultation','procedure']
const typeColor = t => ({ new_patient:'bg-purple-100 text-purple-700', follow_up:'bg-blue-100 text-blue-700', emergency:'bg-red-100 text-red-700', consultation:'bg-[#0D9488]/15 text-[#0D9488]', procedure:'bg-orange-100 text-orange-700' }[t] || 'bg-slate-100 text-slate-700')
const statusColor = s => ({ scheduled:'bg-slate-100 text-slate-700', arrived:'bg-blue-50 text-blue-700', in_progress:'bg-orange-50 text-orange-700', completed:'bg-green-50 text-green-700', cancelled:'bg-red-50 text-red-600', no_show:'bg-slate-200 text-slate-600' }[s] || 'bg-slate-100')

function App() {
  const router = useRouter()
  const [date, setDate] = useState(todayIso())
  const [list, setList] = useState([])
  const [view, setView] = useState('list')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    const pid = url.searchParams.get('patient')
    if (pid) setOpen(true)
  }, [])

  const load = async () => { const r = await fetch(`/api/appointments?date=${date}`); const d = await r.json(); setList(d.appointments||[]) }
  useEffect(() => { load() }, [date])

  const setStatus = async (id, status) => { const r = await fetch(`/api/appointments/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status}) }); if (r.ok) { toast.success('Updated'); load() } }
  const startVisit = async (a) => {
    await fetch(`/api/appointments/${a.id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status:'arrived' })
    })
    if (!a.patient_id) {
      toast.error('Please create patient first')
      return
    }
    const r = await fetch('/api/visits', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        patient_id: a.patient_id,
        appointment_id: a.id
      })
    })
    
    const d = await r.json()
    
    if (r.ok) {
      router.push(`/visits/${d.id}`)
    } else {
      toast.error(d.error || 'Failed')
    }
  
  }

  const summary = { scheduled: list.filter(a=>a.status==='scheduled').length, completed: list.filter(a=>a.status==='completed').length, cancelled: list.filter(a=>a.status==='cancelled').length }
  // group by doctor for By Doctor view
  const byDoctor = {}
  for (const a of list) { const k = a.doctor_id || 'unassigned'; (byDoctor[k] = byDoctor[k] || { name: a.doctor_name||'Unassigned', items: [] }).items.push(a) }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={()=>setDate(shiftDate(date,-1))}><ChevronLeft className="w-4 h-4"/></Button>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="px-3 py-1.5 border border-input rounded-md text-sm font-medium"/>
          <Button size="icon" variant="outline" onClick={()=>setDate(shiftDate(date, 1))}><ChevronRight className="w-4 h-4"/></Button>
          <Button size="sm" variant="ghost" onClick={()=>setDate(todayIso())} className="text-[#0D9488]">Today</Button>
          <span className="ml-2 text-sm text-muted-foreground">{fmtFull(date)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#F8FAFC] border border-border rounded-md p-0.5">
            <button onClick={()=>setView('list')} className={`px-3 py-1 text-xs rounded ${view==='list'?'bg-white shadow-sm font-medium':'text-muted-foreground'}`}>List</button>
            <button onClick={()=>setView('doctor')} className={`px-3 py-1 text-xs rounded ${view==='doctor'?'bg-white shadow-sm font-medium':'text-muted-foreground'}`}>By Doctor</button>
          </div>
          <Button onClick={()=>setOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>New Appointment</Button>
        </div>
      </div>

      {view==='list' ? (
        <Card className="mt-5 bg-white border-border rounded-lg overflow-hidden">
          {list.length===0 ? (
            <div className="py-16 text-center">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/40"/>
              <p className="mt-3 text-muted-foreground">No appointments for this date</p>
              <Button onClick={()=>setOpen(true)} className="mt-3 bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add First Appointment</Button>
            </div>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-muted-foreground tracking-wider">
                <tr><th className="px-5 py-3 font-medium">Time</th><th className="px-5 py-3 font-medium">Patient</th><th className="px-5 py-3 font-medium">Phone</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Doctor</th><th className="px-5 py-3 font-medium">Chief Complaint</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr>
              </thead>
              <tbody>
                {list.map(a => (
                  <tr key={a.id} className="border-t border-border hover:bg-[#F8FAFC]/50">
                    <td className="px-5 py-3 font-semibold text-[#0D9488] whitespace-nowrap">{a.appointment_time}</td>
                    <td className="px-5 py-3">{a.patient_id ? <Link href={`/patients/${a.patient_id}`} className="font-medium hover:text-[#0D9488]">{a.patient_name}</Link> : <span className="font-medium">{a.patient_name_temp} <span className="text-xs text-orange-600">(walk-in)</span></span>}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">+91 {a.patient_phone||a.patient_phone_temp||'—'}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-1 rounded-full capitalize ${typeColor(a.appointment_type)}`}>{a.appointment_type?.replace('_',' ')}</span></td>
                    <td className="px-5 py-3 text-muted-foreground">{a.doctor_name||'—'}</td>
                    <td className="px-5 py-3 text-muted-foreground max-w-[200px] truncate">{a.chief_complaint||'—'}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-1 rounded-full capitalize whitespace-nowrap ${statusColor(a.status)}`}>{a.status?.replace('_',' ')}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end items-center gap-1">
                      {a.status==='scheduled' && (
  <Button
    size="sm"
    onClick={()=>startVisit(a)}
    className="h-7 text-xs bg-[#0D9488] hover:bg-[#0B7E73]"
  >
    Check In
  </Button>
)}
                        
                        {a.status==='in_progress' && a.visit_id && <Button size="sm" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-7 text-xs bg-orange-500 hover:bg-orange-600">Continue</Button>}
                        {a.status==='completed' && a.visit_id && <Button size="sm" variant="outline" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-7 text-xs">View</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button className="w-7 h-7 hover:bg-muted rounded flex items-center justify-center"><MoreVertical className="w-3.5 h-3.5"/></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={()=>setStatus(a.id,'cancelled')}>Cancel</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>setStatus(a.id,'no_show')}>Mark No Show</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-[#F8FAFC] border-t border-border text-xs text-muted-foreground">{summary.scheduled} scheduled · {summary.completed} completed · {summary.cancelled} cancelled</div>
            </>
          )}
        </Card>
      ) : (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(byDoctor).length===0 && <Card className="col-span-full p-12 text-center text-muted-foreground bg-white border-border rounded-lg">No appointments today</Card>}
          {Object.values(byDoctor).map((g,i) => (
            <Card key={i} className="p-4 bg-white border-border rounded-lg">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <div className="w-9 h-9 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-sm font-semibold text-[#0D9488]">{g.name?.[0]?.toUpperCase()}</div>
                <div><div className="font-medium text-sm">{g.name}</div><div className="text-xs text-muted-foreground">{g.items.length} appointments</div></div>
              </div>
              {g.items.map(a => (
                <div key={a.id} className="py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center justify-between"><span className="font-semibold text-[#0D9488] text-sm">{a.appointment_time}</span><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColor(a.status)}`}>{a.status?.replace('_',' ')}</span></div>
                  <div className="text-sm font-medium mt-1">{a.patient_name||a.patient_name_temp}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.appointment_type?.replace('_',' ')} · {a.chief_complaint||'—'}</div>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
      <NewAppointmentModal open={open} setOpen={setOpen} initialDate={date} onCreated={load} />
    </div>
  )
}

function NewAppointmentModal({ open, setOpen, initialDate, onCreated }) {
  const [doctors, setDoctors] = useState([])
  const [pq, setPq] = useState('')
  const [pResults, setPresults] = useState([])
  const [picked, setPicked] = useState(null)
  const [walkin, setWalkin] = useState(false)
  const [walkinForm, setWalkinForm] = useState({ name:'', phone:'' })
  const [f, setF] = useState({ doctor_id:'', appointment_date: initialDate, appointment_time:'10:00 AM', duration_minutes:30, appointment_type:'consultation', chief_complaint:'', notes:'', booked_via:'in_clinic' })
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { fetch('/api/doctors').then(r=>r.json()).then(d=>setDoctors(d.doctors||[])); setF(p=>({...p, appointment_date: initialDate})) } }, [open, initialDate])
  useEffect(() => {
    if (!pq) { setPresults([]); return }
    const t = setTimeout(async () => { const r = await fetch(`/api/patients?q=${encodeURIComponent(pq)}`); const d = await r.json(); setPresults((d.patients||[]).slice(0,5)) }, 250)
    return () => clearTimeout(t)
  }, [pq])
  // conflict check
  useEffect(() => {
    if (!f.doctor_id || !f.appointment_date || !f.appointment_time) { setConflict(false); return }
    fetch(`/api/appointments?date=${f.appointment_date}`).then(r=>r.json()).then(d => {
      setConflict((d.appointments||[]).some(a => a.doctor_id===f.doctor_id && a.appointment_time===f.appointment_time && !['cancelled','no_show'].includes(a.status)))
    })
  }, [f.doctor_id, f.appointment_date, f.appointment_time])

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    let patient_id = picked?.id || null
    let walkinFields = { patient_name_temp:'', patient_phone_temp:'' }
    if (walkin && walkinForm.name && walkinForm.phone) {
      // create patient inline
      if (!/^\d{10}$/.test(walkinForm.phone)) { toast.error('Phone must be 10 digits'); setBusy(false); return }
      const r = await fetch('/api/patients', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: walkinForm.name, phone: walkinForm.phone }) })
      const d = await r.json()
      if (r.ok) patient_id = d.id
      else { toast.error('Failed to create patient'); setBusy(false); return }
    }
    if (!patient_id) { toast.error('Select a patient'); setBusy(false); return }
    const r = await fetch('/api/appointments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...f, patient_id }) })
    setBusy(false)
    if (r.ok) { toast.success(`Appointment booked${picked?` for ${picked.name}`:''}`); setOpen(false); setPicked(null); setPq(''); setWalkin(false); setWalkinForm({name:'',phone:''}); onCreated && onCreated() }
    else toast.error('Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Book Appointment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Patient</Label>
            {picked ? (
              <div className="flex items-center justify-between p-2 px-3 border border-border rounded-md bg-[#F8FAFC]"><div><div className="font-medium text-sm">{picked.name}</div><div className="text-xs text-muted-foreground">+91 {picked.phone}</div></div><button type="button" onClick={()=>setPicked(null)} className="text-xs text-[#0D9488] hover:underline">Change</button></div>
            ) : walkin ? (
              <div className="grid grid-cols-2 gap-2"><Input placeholder="Patient name" value={walkinForm.name} onChange={e=>setWalkinForm({...walkinForm,name:e.target.value})}/><Input placeholder="Phone (10 digits)" value={walkinForm.phone} onChange={e=>setWalkinForm({...walkinForm,phone:e.target.value.replace(/\D/g,'').slice(0,10)})}/><button type="button" onClick={()=>setWalkin(false)} className="col-span-2 text-xs text-[#0D9488] hover:underline text-left">← Search existing patient instead</button></div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input value={pq} onChange={e=>setPq(e.target.value)} placeholder="Type name or phone…" className="pl-9"/>
                {pq && <div className="absolute top-11 left-0 right-0 bg-white border border-border rounded-md shadow z-10 max-h-60 overflow-y-auto">
                  {pResults.map(p => (
                    <button key={p.id} type="button" onClick={()=>{setPicked(p); setPq('')}} className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] border-b border-border"><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></button>
                  ))}
                  <button type="button" onClick={()=>{setWalkin(true); setPq('')}} className="w-full text-left px-3 py-2 hover:bg-[#0D9488]/5 text-[#0D9488] text-sm flex items-center gap-1"><Plus className="w-3 h-3"/>Create New Patient</button>
                </div>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Doctor</Label><Select value={f.doctor_id} onValueChange={v=>setF({...f,doctor_id:v})}><SelectTrigger><SelectValue placeholder="Select doctor"/></SelectTrigger><SelectContent>{doctors.map(d=><SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Type</Label><Select value={f.appointment_type} onValueChange={v=>setF({...f,appointment_type:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TYPES.map(t=><SelectItem key={t} value={t} className="capitalize">{t.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.appointment_date} onChange={e=>setF({...f,appointment_date:e.target.value})}/></div>
            <div className="space-y-1.5"><Label>Time</Label><Input value={f.appointment_time} onChange={e=>setF({...f,appointment_time:e.target.value})}/></div>
            <div className="space-y-1.5"><Label>Duration</Label><Select value={String(f.duration_minutes)} onValueChange={v=>setF({...f,duration_minutes:parseInt(v)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[15,30,45,60].map(d=><SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Booked Via</Label><Select value={f.booked_via} onValueChange={v=>setF({...f,booked_via:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="in_clinic">In-Clinic</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label>Chief Complaint</Label><Input value={f.chief_complaint} onChange={e=>setF({...f,chief_complaint:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></div>
          {conflict && <div className="p-2.5 rounded-md bg-orange-50 border border-orange-200 text-sm text-orange-800">⚠️ This doctor already has an appointment at this time. You can still save if intentional.</div>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy} className="bg-[#0D9488] hover:bg-[#0B7E73]">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:'Book Appointment'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
