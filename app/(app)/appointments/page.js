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
import BalanceBadge from '@/components/dentos/BalanceBadge'
import OutstandingBalanceModal from '@/components/dentos/OutstandingBalanceModal'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'

const todayIso = () => new Date().toISOString().slice(0,10)
const fmtFull = d => { const x = new Date(d+'T00:00:00'); return x.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) }
const shiftDate = (iso, days) => { const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10) }
const STATUS = ['scheduled','arrived','in_progress','completed','cancelled','no_show']
const TYPES = ['new_patient','follow_up','emergency','consultation','procedure']
const typeColor = t => ({ new_patient:'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300', follow_up:'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300', emergency:'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300', consultation:'bg-[#0D9488]/15 text-[#0D9488]', procedure:'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300' }[t] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')
const statusColor = s => ({ scheduled:'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', arrived:'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300', in_progress:'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300', completed:'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300', cancelled:'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400', no_show:'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400' }[s] || 'bg-slate-100 dark:bg-slate-800')
const patientStatusBadge = (a) => {
  if (a.visitor_type === 'returning' && a.patient_id) {
    return { text: 'Returning Patient', className: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300' }
  }
  if (a.visitor_type === 'new') {
    return { text: 'New Patient', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' }
  }
  if (a.visitor_type === 'returning_unmatched') {
    return { text: 'Returning — Verify Records', className: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300' }
  }
  if (!a.patient_id) {
    return { text: 'Online Booking — Verify Identity', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' }
  }
  if (a.patient_total_visits > 0) {
    return { text: 'Returning Patient', className: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300' }
  }
  return { text: 'New Patient', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' }
}

function App() {
  const router = useRouter()
  const [date, setDate] = useState(todayIso())
  const [list, setList] = useState([])
  const [view, setView] = useState('list')
  const [open, setOpen] = useState(false)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const pid = url.searchParams.get('patient')
    if (pid) setOpen(true)
  }, [])

  const load = async ({ silent } = {}) => {
    if (!silent) setLoading(true)
    const r = await fetch(`/api/appointments?date=${date}`)
    const d = await r.json()
    setList(d.appointments||[])
    if (!silent) setLoading(false)
  }
  useEffect(() => { load() }, [date])
  useLiveRefresh(() => load({ silent: true }), [date])

  const setStatus = async (id, status) => { const r = await fetch(`/api/appointments/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status}) }); if (r.ok) { toast.success('Updated'); load() } }
  const startVisit = async (a) => {
    await fetch(`/api/appointments/${a.id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status:'arrived' })
    })
    const r = await fetch('/api/visits', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        patient_id: a.patient_id || null,
        appointment_id: a.id
      })
    })
    
    const d = await r.json()
    
    if (r.ok) {
      router.push(`/visits/${d.id}`)
    } else if (d.error === 'returning_unmatched') {
      setSelectedAppointment(a)
      setVerifyModalOpen(true)
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button size="icon" variant="outline" onClick={()=>setDate(shiftDate(date,-1))} className="h-10 w-10"><ChevronLeft className="w-4 h-4"/></Button>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="px-3 py-2 border border-input rounded-md text-sm font-medium h-10"/>
          <Button size="icon" variant="outline" onClick={()=>setDate(shiftDate(date, 1))} className="h-10 w-10"><ChevronRight className="w-4 h-4"/></Button>
          <Button size="sm" variant="ghost" onClick={()=>setDate(todayIso())} className="text-[#0D9488] h-10">Today</Button>
        </div>
        <span className="text-sm text-muted-foreground sm:ml-2">{fmtFull(date)}</span>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <div className="flex bg-muted border border-border rounded-md p-0.5">
            <button onClick={()=>setView('list')} className={`px-3 py-2 text-xs rounded ${view==='list'?'bg-card shadow-sm font-medium':'text-muted-foreground'}`}>List</button>
            <button onClick={()=>setView('doctor')} className={`px-3 py-2 text-xs rounded ${view==='doctor'?'bg-card shadow-sm font-medium':'text-muted-foreground'}`}>By Doctor</button>
          </div>
          <Button onClick={()=>setOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73] h-10 w-full sm:w-auto"><Plus className="w-4 h-4 mr-1"/>New Appointment</Button>
        </div>
      </div>

      {view==='list' ? (
        <Card className="mt-5 bg-card border-border rounded-lg overflow-hidden">
          {loading && (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-border">
                  <div className="h-4 bg-muted rounded w-16 animate-pulse"/>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3 animate-pulse"/>
                    <div className="h-3 bg-muted rounded w-1/4 animate-pulse"/>
                  </div>
                  <div className="h-4 bg-muted rounded w-20 animate-pulse"/>
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"/>
                  <div className="h-4 bg-muted rounded w-16 animate-pulse"/>
                  <div className="h-4 bg-muted rounded w-32 animate-pulse"/>
                  <div className="h-4 bg-muted rounded w-20 animate-pulse"/>
                  <div className="h-8 bg-muted rounded w-24 animate-pulse"/>
                </div>
              ))}
            </div>
          )}
          {!loading && list.length===0 ? (
            <div className="py-12 md:py-16 text-center">
              <Calendar className="w-8 h-8 md:w-10 md:h-10 mx-auto text-muted-foreground/40"/>
              <p className="mt-3 text-muted-foreground">No appointments for this date</p>
              <Button onClick={()=>setOpen(true)} className="mt-3 bg-[#0D9488] hover:bg-[#0B7E73] h-11"><Plus className="w-4 h-4 mr-1"/>Add First Appointment</Button>
            </div>
          ) : (
            <>
            {!loading && (
              <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground tracking-wider">
                    <tr><th className="px-5 py-3 font-medium">Time</th><th className="px-5 py-3 font-medium">Patient</th><th className="px-5 py-3 font-medium">Phone</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Doctor</th><th className="px-5 py-3 font-medium">Chief Complaint</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr>
                  </thead>
                  <tbody>
                    {list.map(a => (
                      <tr key={a.id} className="border-t border-border hover:bg-muted/50">
                        <td className="px-5 py-3 font-semibold text-[#0D9488] whitespace-nowrap">{a.appointment_time}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {a.patient_id ? <Link href={`/patients/${a.patient_id}`} className="font-medium hover:text-[#0D9488]">{a.patient_name}</Link> : <span className="font-medium">{a.patient_name_temp} <span className="text-xs text-orange-600">(walk-in)</span></span>}
                              {a.patient_id && (
                                <BalanceBadge
                                  patientId={a.patient_id}
                                  onClick={() => {
                                    setSelectedPatientId(a.patient_id)
                                    setBalanceModalOpen(true)
                                  }}
                                />
                              )}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${patientStatusBadge(a).className}`}>{patientStatusBadge(a).text}</span>
                          </div>
                        </td>
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
                className="h-8 text-xs bg-[#0D9488] hover:bg-[#0B7E73]"
              >
                Check In
              </Button>
            )}
                          
                          {a.status==='in_progress' && a.visit_id && <Button size="sm" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-8 text-xs bg-orange-500 hover:bg-orange-600">Continue</Button>}
                          {a.status==='completed' && a.visit_id && <Button size="sm" variant="outline" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-8 text-xs">View</Button>}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><button className="w-8 h-8 hover:bg-muted rounded flex items-center justify-center"><MoreVertical className="w-3.5 h-3.5"/></button></DropdownMenuTrigger>
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
                <div className="px-5 py-3 bg-muted border-t border-border text-xs text-muted-foreground">{summary.scheduled} scheduled · {summary.completed} completed · {summary.cancelled} cancelled</div>
              </div>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-4">
                {list.map(a => (
                  <div key={a.id} className="border border-border rounded-lg p-4 bg-card">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-[#0D9488] text-sm">{a.appointment_time}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${statusColor(a.status)}`}>{a.status?.replace('_',' ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.patient_id ? <Link href={`/patients/${a.patient_id}`} className="font-medium text-sm hover:text-[#0D9488] truncate">{a.patient_name}</Link> : <span className="font-medium text-sm truncate">{a.patient_name_temp} <span className="text-xs text-orange-600">(walk-in)</span></span>}
                          {a.patient_id && (
                            <BalanceBadge
                              patientId={a.patient_id}
                              onClick={() => {
                                setSelectedPatientId(a.patient_id)
                                setBalanceModalOpen(true)
                              }}
                            />
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full w-fit inline-block mt-1 ${patientStatusBadge(a).className}`}>{patientStatusBadge(a).text}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div><span className="text-muted-foreground">Phone:</span> +91 {a.patient_phone||a.patient_phone_temp||'—'}</div>
                      <div><span className="text-muted-foreground">Type:</span> <span className={`px-1.5 py-0.5 rounded capitalize ${typeColor(a.appointment_type)}`}>{a.appointment_type?.replace('_',' ')}</span></div>
                      <div><span className="text-muted-foreground">Doctor:</span> {a.doctor_name||'—'}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">Chief Complaint:</span> {a.chief_complaint||'—'}</div>
                    </div>
                    <div className="flex gap-2">
                      {a.status==='scheduled' && (
                        <Button size="sm" onClick={()=>startVisit(a)} className="h-10 flex-1 text-xs bg-[#0D9488] hover:bg-[#0B7E73]">Check In</Button>
                      )}
                      {a.status==='in_progress' && a.visit_id && <Button size="sm" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-10 flex-1 text-xs bg-orange-500 hover:bg-orange-600">Continue</Button>}
                      {a.status==='completed' && a.visit_id && <Button size="sm" variant="outline" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-10 flex-1 text-xs">View</Button>}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button className="w-10 h-10 hover:bg-muted rounded flex items-center justify-center flex-shrink-0"><MoreVertical className="w-4 h-4"/></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={()=>setStatus(a.id,'cancelled')}>Cancel</DropdownMenuItem>
                          <DropdownMenuItem onClick={()=>setStatus(a.id,'no_show')}>Mark No Show</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3 bg-muted border-t border-border text-xs text-muted-foreground rounded-b-lg">{summary.scheduled} scheduled · {summary.completed} completed · {summary.cancelled} cancelled</div>
              </div>
              </>
            )}
            </>
          )}
        </Card>
      ) : (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(byDoctor).length===0 && <Card className="col-span-full p-12 text-center text-muted-foreground bg-card border-border rounded-lg">No appointments today</Card>}
          {Object.values(byDoctor).map((g,i) => (
            <Card key={i} className="p-4 bg-card border-border rounded-lg">
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
      <VerifyPatientModal open={verifyModalOpen} setOpen={setVerifyModalOpen} appointment={selectedAppointment} onVerified={load} />
      <OutstandingBalanceModal open={balanceModalOpen} onOpenChange={setBalanceModalOpen} patientId={selectedPatientId} />
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
    else if (r.status === 409) {
      const d = await r.json()
      toast.error(d.message || 'This appointment slot is already booked. Please select another time.')
    }
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
              <div className="flex items-center justify-between p-2 px-3 border border-border rounded-md bg-muted"><div><div className="font-medium text-sm">{picked.name}</div><div className="text-xs text-muted-foreground">+91 {picked.phone}</div></div><button type="button" onClick={()=>setPicked(null)} className="text-xs text-[#0D9488] hover:underline">Change</button></div>
            ) : walkin ? (
              <div className="grid grid-cols-2 gap-2"><Input placeholder="Patient name" value={walkinForm.name} onChange={e=>setWalkinForm({...walkinForm,name:e.target.value})}/><Input placeholder="Phone (10 digits)" value={walkinForm.phone} onChange={e=>setWalkinForm({...walkinForm,phone:e.target.value.replace(/\D/g,'').slice(0,10)})}/><button type="button" onClick={()=>setWalkin(false)} className="col-span-2 text-xs text-[#0D9488] hover:underline text-left">← Search existing patient instead</button></div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input value={pq} onChange={e=>setPq(e.target.value)} placeholder="Type name or phone…" className="pl-9"/>
                {pq && <div className="absolute top-11 left-0 right-0 bg-card border border-border rounded-md shadow z-10 max-h-60 overflow-y-auto">
                  {pResults.map(p => (
                    <button key={p.id} type="button" onClick={()=>{setPicked(p); setPq('')}} className="w-full text-left px-3 py-2 hover:bg-muted border-b border-border"><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></button>
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

function VerifyPatientModal({ open, setOpen, appointment, onVerified }) {
  const [pq, setPq] = useState('')
  const [pResults, setPresults] = useState([])
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) { setPq(''); setPresults([]); setPicked(null) }
  }, [open])

  useEffect(() => {
    if (!pq) { setPresults([]); return }
    const t = setTimeout(async () => { const r = await fetch(`/api/patients?q=${encodeURIComponent(pq)}`); const d = await r.json(); setPresults((d.patients||[]).slice(0,5)) }, 250)
    return () => clearTimeout(t)
  }, [pq])

  const handleLinkExisting = async () => {
    if (!picked) { toast.error('Please select a patient'); return }
    setBusy(true)
    // Link appointment to selected patient
    await fetch(`/api/appointments/${appointment.id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ patient_id: picked.id })
    })
    // Create visit
    const r = await fetch('/api/visits', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        patient_id: picked.id,
        appointment_id: appointment.id
      })
    })
    setBusy(false)
    if (r.ok) {
      const d = await r.json()
      setOpen(false)
      onVerified()
      window.location.href = `/visits/${d.id}`
    } else {
      toast.error('Failed to create visit')
    }
  }

  const handleCreateNew = async () => {
    setBusy(true)
    // Create new patient
    const r = await fetch('/api/patients', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        name: appointment.patient_name_temp,
        phone: appointment.patient_phone_temp
      })
    })
    const d = await r.json()
    if (!r.ok) { toast.error('Failed to create patient'); setBusy(false); return }
    // Link appointment to new patient
    await fetch(`/api/appointments/${appointment.id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ patient_id: d.id })
    })
    // Create visit
    const vr = await fetch('/api/visits', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        patient_id: d.id,
        appointment_id: appointment.id
      })
    })
    setBusy(false)
    if (vr.ok) {
      const vd = await vr.json()
      setOpen(false)
      onVerified()
      window.location.href = `/visits/${vd.id}`
    } else {
      toast.error('Failed to create visit')
    }
  }

  if (!appointment) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Verify Patient Records</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This patient said they visited before but we couldn't find their records with phone <span className="font-medium">+91 {appointment.patient_phone_temp}</span>. What would you like to do?
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Search for existing patient</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input value={pq} onChange={e=>setPq(e.target.value)} placeholder="Type name or phone…" className="pl-9"/>
                {pq && <div className="absolute top-11 left-0 right-0 bg-card border border-border rounded-md shadow z-10 max-h-60 overflow-y-auto">
                  {pResults.map(p => (
                    <button key={p.id} type="button" onClick={()=>{setPicked(p); setPq('')}} className="w-full text-left px-3 py-2 hover:bg-muted border-b border-border"><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></button>
                  ))}
                </div>}
              </div>
            </div>
            {picked && (
              <div className="p-3 bg-muted border border-border rounded-md">
                <div className="font-medium text-sm">Selected: {picked.name}</div>
                <div className="text-xs text-muted-foreground">+91 {picked.phone}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleLinkExisting} disabled={!picked || busy} className="flex-1 bg-[#0D9488] hover:bg-[#0B7E73]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Find & Link Existing Patient'}
            </Button>
            <Button onClick={handleCreateNew} variant="outline" disabled={busy} className="flex-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Create as New Patient'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default App
