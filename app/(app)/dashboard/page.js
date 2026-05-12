'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, IndianRupee, AlertCircle, UserCheck, Clock, MoreVertical, MessageCircle, Plus, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'

const todayIso = () => new Date().toISOString().slice(0,10)
const fmtDate = d => { const x = new Date(d); return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}` }
const inr = n => '₹' + (n||0).toLocaleString('en-IN')

const statusBadge = s => {
  const map = {
    scheduled:'bg-slate-100 text-slate-700', arrived:'bg-blue-50 text-blue-700',
    in_progress:'bg-orange-50 text-orange-700', completed:'bg-green-50 text-green-700',
    cancelled:'bg-red-50 text-red-600', no_show:'bg-slate-200 text-slate-600',
  }
  return <span className={`text-xs px-2 py-1 rounded-full capitalize whitespace-nowrap ${map[s]||'bg-slate-100'}`}>{s.replace('_',' ')}</span>
}

function App() {
  const router = useRouter()
  const { isReceptionist } = useRole()
  const receptionist = isReceptionist()
  const [stats, setStats] = useState(null)
  const [bookOpen, setBookOpen] = useState(false)

  const load = () => fetch('/api/dashboard/stats').then(r=>r.json()).then(setStats)
  useEffect(() => { load() }, [])

  const setStatus = async (id, status) => {
    await fetch(`/api/appointments/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) })
    toast.success('Updated'); load()
  }
  const startVisit = async (apt) => {
    const r = await fetch('/api/visits', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ appointment_id: apt.id, patient_id: apt.patient_id, doctor_id: apt.doctor_id, chief_complaint: apt.chief_complaint }) })
    const d = await r.json()
    if (r.ok) router.push(`/visits/${d.id}`)
    else toast.error(d.error||'Failed')
  }
  const cont = (apt) => apt.visit_id ? router.push(`/visits/${apt.visit_id}`) : startVisit(apt)

  const cards = [
    { label:'Patients Seen Today', val: stats?.patients_seen_today ?? '—', sub: stats ? `${stats.patients_seen_yesterday>=0?`vs ${stats.patients_seen_yesterday} yesterday`:''}` : '', icon: UserCheck, color:'#0D9488' },
    { label:'Revenue Collected', val: stats ? inr(stats.revenue_today) : '—', sub:'Across paid invoices today', icon: IndianRupee, color:'#22C55E' },
    { label:'Pending Payments', val: stats ? inr(stats.pending_today) : '—', sub:'Pending & partial today', icon: AlertCircle, color: stats?.pending_today>0?'#F59E0B':'#94A3B8' },
    { label:'Follow-ups Due', val: stats?.followups_due_count ?? '—', sub:'Patients due for return visit', icon: Calendar, color: stats?.followups_due_count>0?'#EF4444':'#94A3B8' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <Card key={c.label} className="p-5 bg-white border-border rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">{c.label}</div>
                  <div className="text-3xl font-bold mt-2" style={{color: c.color}}>{c.val}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: c.color+'15'}}><Icon className="w-5 h-5" style={{color: c.color}}/></div>
              </div>
            </Card>
          )
        })}
      </div>

      <QuickSearchBar onBook={()=>setBookOpen(true)} receptionist={receptionist} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-3 p-6 bg-white border-border rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-[#0F172A]">Today&apos;s Appointment Queue</h3>
            <span className="text-xs text-muted-foreground">{fmtDate(new Date())}</span>
          </div>
          {!stats && <div className="text-sm text-muted-foreground py-6">Loading…</div>}
          {stats && stats.today_queue.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50"/>
              <p className="text-sm text-muted-foreground mt-2">No appointments scheduled for today</p>
              <Button onClick={()=>setBookOpen(true)} className="mt-3 bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Appointment</Button>
            </div>
          )}
          {stats && stats.today_queue.length > 0 && (
            <table className="w-full text-sm mt-3">
              <thead className="text-xs uppercase text-muted-foreground tracking-wider border-b border-border">
                <tr><th className="text-left py-2 font-medium">Time</th><th className="text-left font-medium">Patient</th><th className="text-left font-medium">Type</th><th className="text-left font-medium">Doctor</th><th className="text-left font-medium">Status</th><th className="text-right font-medium">Action</th></tr>
              </thead>
              <tbody>
                {stats.today_queue.map(a => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium text-[#0D9488] whitespace-nowrap">{a.appointment_time}</td>
                    <td className="py-3"><Link href={`/patients/${a.patient_id}`} className="font-medium hover:text-[#0D9488]">{a.patient_name||a.patient_name_temp}</Link></td>
                    <td className="py-3 text-muted-foreground capitalize">{a.appointment_type?.replace('_',' ')}</td>
                    <td className="py-3 text-muted-foreground">{a.doctor_name||'—'}</td>
                    <td className="py-3">{statusBadge(a.status)}</td>
                    <td className="py-3">
                      <div className="flex justify-end items-center gap-1">
                        {a.status==='scheduled' && <Button size="sm" onClick={()=>setStatus(a.id,'arrived')} className="h-7 text-xs bg-blue-600 hover:bg-blue-700">{receptionist ? 'Check In' : 'Mark Arrived'}</Button>}
                        {!receptionist && a.status==='arrived' && <Button size="sm" onClick={()=>startVisit(a)} className="h-7 text-xs bg-[#0D9488] hover:bg-[#0B7E73]">Start Visit</Button>}
                        {receptionist && a.status==='arrived' && <span className="text-xs text-muted-foreground whitespace-nowrap pr-1">Waiting for doctor</span>}
                        {!receptionist && a.status==='in_progress' && <Button size="sm" onClick={()=>cont(a)} className="h-7 text-xs bg-orange-500 hover:bg-orange-600">Continue</Button>}
                        {!receptionist && a.status==='completed' && a.visit_id && <Button size="sm" variant="outline" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-7 text-xs">View</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button className="w-7 h-7 hover:bg-muted rounded flex items-center justify-center"><MoreVertical className="w-3.5 h-3.5"/></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={()=>setStatus(a.id,'cancelled')}>Cancel Appointment</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>setStatus(a.id,'no_show')}>Mark No Show</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="lg:col-span-2 p-6 bg-white border-border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#0F172A]">Pending Follow-ups</h3>
            {stats?.followups?.length>0 && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Due Now</span>}
          </div>
          {stats?.followups?.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No follow-ups pending</div>}
          {stats?.followups?.map(p => {
            const overdue = new Date(p.next_followup_date) < new Date()
            return (
              <div key={p.id} className="py-3 border-b border-border last:border-0">
                <div className="flex items-center justify-between">
                  <Link href={`/patients/${p.id}`} className="font-medium text-sm hover:text-[#0D9488]">{p.name}</Link>
                  <span className={`text-xs ${overdue?'text-[#EF4444]':'text-success'}`}>{fmtDate(p.next_followup_date)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.last_visit_reason || '—'}</div>
                <div className="flex gap-2 mt-2">
                  <a href={`https://wa.me/91${p.phone}?text=${encodeURIComponent(`Hello ${p.name}, this is a reminder for your follow-up appointment at ${stats.clinic_name}. Please call us to book your visit.`)}`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"><MessageCircle className="w-3 h-3"/>WhatsApp</a>
                  <button className="text-xs px-2 py-1 rounded bg-[#0D9488]/10 text-[#0D9488] hover:bg-[#0D9488]/20">Book Appointment</button>
                </div>
              </div>
            )
          })}
          {stats?.followups?.length>0 && <Link href="/patients" className="text-xs text-[#0D9488] hover:underline mt-3 inline-block">View all follow-ups →</Link>}
        </Card>
      </div>
      <BookAppointmentModal open={bookOpen} setOpen={setBookOpen} onCreated={load} />
    </div>
  )
}

function QuickSearchBar({ onBook, receptionist }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const debRef = require('react').useRef(null)
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current)
    if (!q.trim()) { setResults([]); return }
    debRef.current = setTimeout(async () => {
      const r = await fetch(`/api/patients?q=${encodeURIComponent(q)}`)
      const d = await r.json(); setResults((d.patients||[]).slice(0,5))
    }, 300)
  }, [q])
  return (
    <Card className="p-5 bg-white border-border rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or phone number…" className="pl-9 h-11 text-base"/>
          {q && (
            <div className="absolute top-12 left-0 right-0 bg-white border border-border rounded-md shadow-lg z-10">
              {results.length===0 ? <div className="p-3 text-sm flex items-center justify-between"><span className="text-muted-foreground">No patient found.</span>{!receptionist && <Link href="/patients" className="text-[#0D9488] hover:underline flex items-center gap-1"><Plus className="w-3 h-3"/>Add New Patient</Link>}</div>
               : results.map(p=>(
                <button key={p.id} onClick={()=>router.push(`/patients/${p.id}`)} className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAFC] border-b border-border last:border-0 flex items-center justify-between">
                  <div><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></div>
                  <span className="text-xs text-muted-foreground">{p.last_visit_date ? `Last: ${fmtDate(p.last_visit_date)}` : 'No visits'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={onBook} className="bg-[#0D9488] hover:bg-[#0B7E73] h-11"><Plus className="w-4 h-4 mr-1"/>Quick Book</Button>
      </div>
    </Card>
  )
}

function BookAppointmentModal({ open, setOpen, onCreated }) {
  const [patients, setPatients] = useState([])
  const [f, setF] = useState({ patient_id:'', appointment_date: todayIso(), appointment_time:'10:00 AM', appointment_type:'consultation', chief_complaint:'', notes:'' })
  useEffect(() => { if (open) fetch('/api/patients').then(r=>r.json()).then(d=>setPatients(d.patients||[])) }, [open])
  const submit = async e => {
    e.preventDefault()
    if (!f.patient_id) { toast.error('Select patient'); return }
    const r = await fetch('/api/appointments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(f) })
    if (r.ok) { toast.success('Appointment booked'); setOpen(false); onCreated && onCreated() }
    else toast.error('Failed')
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Quick Book Appointment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={v=>setF({...f,patient_id:v})}><SelectTrigger><SelectValue placeholder="Select patient"/></SelectTrigger>
              <SelectContent>{patients.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · +91 {p.phone}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.appointment_date} onChange={e=>setF({...f,appointment_date:e.target.value})}/></div>
            <div className="space-y-1.5"><Label>Time</Label><Input value={f.appointment_time} onChange={e=>setF({...f,appointment_time:e.target.value})}/></div>
          </div>
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={f.appointment_type} onValueChange={v=>setF({...f,appointment_type:v})}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{['new_patient','follow_up','emergency','consultation','procedure'].map(t=><SelectItem key={t} value={t} className="capitalize">{t.replace('_',' ')}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Chief Complaint</Label><Textarea rows={2} value={f.chief_complaint} onChange={e=>setF({...f,chief_complaint:e.target.value})}/></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" className="bg-[#0D9488] hover:bg-[#0B7E73]">Book</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
