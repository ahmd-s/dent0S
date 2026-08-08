'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, IndianRupee, AlertCircle, UserCheck, Clock, MoreVertical, MessageCircle, Plus, Search, FlaskConical, AlertTriangle } from 'lucide-react'
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
import BalanceBadge from '@/components/dentos/BalanceBadge'
import OutstandingBalanceModal from '@/components/dentos/OutstandingBalanceModal'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { Switch } from '@/components/ui/switch'
import ReceptionistPendingTasks from '@/components/dentos/ReceptionistPendingTasks'

const QUEUE_TOGGLE_KEY = 'dentos_show_booking_queue'

const todayIso = () => new Date().toISOString().slice(0,10)
const fmtDate = d => { const x = new Date(d); return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}` }
const inr = n => '₹' + (n||0).toLocaleString('en-IN')

const statusBadge = s => {
  const map = {
    scheduled:'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    arrived:'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
    in_progress:'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
    completed:'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300',
    cancelled:'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    no_show:'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }
  return <span className={`text-xs px-2 py-1 rounded-full capitalize whitespace-nowrap ${map[s]||'bg-slate-100 dark:bg-slate-800'}`}>{s.replace('_',' ')}</span>
}

function App() {
  const router = useRouter()
  const { canAccessClinical, isDoctor } = useRole()
  const canStartVisit = canAccessClinical()
  const showQueueToggle = isDoctor()
  const [showQueue, setShowQueue] = useState(true)
  const [stats, setStats] = useState(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)

  const load = () => fetch('/api/dashboard/stats').then(r=>r.json()).then(setStats)
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(QUEUE_TOGGLE_KEY)
    if (stored !== null) setShowQueue(stored === 'true')
  }, [])
  useLiveRefresh(load)

  const toggleQueue = (v) => {
    setShowQueue(v)
    if (typeof window !== 'undefined') localStorage.setItem(QUEUE_TOGGLE_KEY, String(v))
  }

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
    { label:'Awaiting Lab Acceptance', val: stats?.awaiting_lab_acceptance ?? '—', sub:'Sent, not yet received by lab', icon: FlaskConical, color:'#6366F1', href:'/lab-cases?status=sent' },
    { label:'Cases In Production', val: stats?.in_production_lab_cases ?? '—', sub:'Being made at the lab', icon: FlaskConical, color:'#0D9488', href:'/lab-cases?status=lab_received,in_production,in_progress' },
    { label:'Cases Ready', val: stats?.ready_lab_cases ?? '—', sub:'Ready / awaiting delivery', icon: FlaskConical, color:'#22C55E', href:'/lab-cases?status=ready' },
    { label:'Overdue Cases', val: stats?.overdue_lab_cases ?? '—', sub:'Past expected delivery', icon: AlertTriangle, color: stats?.overdue_lab_cases>0?'#EF4444':'#94A3B8', href:'/lab-cases?status=overdue' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map(c => {
          const Icon = c.icon
          const inner = (
            <Card className={`p-3.5 sm:p-4 md:p-5 bg-card border-border rounded-xl h-full ${c.href?'hover:border-[#0D9488]/40 transition-colors cursor-pointer active:scale-[0.98]':''}`}>
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm text-muted-foreground leading-snug line-clamp-2">{c.label}</div>
                  <div className="text-2xl md:text-3xl font-bold mt-1.5 md:mt-2 leading-none tabular-nums" style={{color: c.color}}>{c.val}</div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-snug">{c.sub}</div>
                </div>
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: c.color+'15'}}>
                  <Icon className="w-4 h-4 md:w-5 md:h-5" style={{color: c.color}}/>
                </div>
              </div>
            </Card>
          )
          return c.href ? <Link key={c.label} href={c.href} className="min-w-0">{inner}</Link> : <div key={c.label} className="min-w-0">{inner}</div>
        })}
      </div>

      <QuickSearchBar onBook={()=>setBookOpen(true)} canStartVisit={canStartVisit} />

      <ReceptionistPendingTasks />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
        {(showQueue || !showQueueToggle) && (
        <Card className="lg:col-span-3 p-4 md:p-6 bg-card border-border rounded-lg">
          <div className="flex items-center justify-between mb-2 md:mb-3 flex-wrap gap-2">
            <h3 className="font-semibold text-foreground text-base md:text-lg">Today&apos;s Appointment Queue</h3>
            <div className="flex items-center gap-3">
              {showQueueToggle && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Switch checked={showQueue} onCheckedChange={toggleQueue} />
                  Show queue
                </label>
              )}
              <span className="text-xs text-muted-foreground">{fmtDate(new Date())}</span>
            </div>
          </div>
          {!stats && <div className="text-sm text-muted-foreground py-6">Loading…</div>}
          {stats && stats.today_queue.length === 0 && (
            <div className="text-center py-8 md:py-12">
              <Calendar className="w-8 h-8 md:w-10 md:h-10 mx-auto text-muted-foreground/50"/>
              <p className="text-sm text-muted-foreground mt-2">No appointments scheduled for today</p>
              <Button onClick={()=>setBookOpen(true)} className="mt-3 bg-[#0D9488] hover:bg-[#0B7E73] h-11 px-4"><Plus className="w-4 h-4 mr-1"/>Add Appointment</Button>
            </div>
          )}
          {stats && stats.today_queue.length > 0 && (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
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
                            {a.status==='scheduled' && <Button size="sm" onClick={()=>setStatus(a.id,'arrived')} className="h-8 text-xs bg-blue-600 hover:bg-blue-700">{!canStartVisit ? 'Check In' : 'Mark Arrived'}</Button>}
                            {canStartVisit && a.status==='arrived' && <Button size="sm" onClick={()=>startVisit(a)} className="h-8 text-xs bg-[#0D9488] hover:bg-[#0B7E73]">Start Visit</Button>}
                            {!canStartVisit && a.status==='arrived' && <span className="text-xs text-muted-foreground whitespace-nowrap pr-1">Waiting for doctor</span>}
                            {canStartVisit && a.status==='in_progress' && <Button size="sm" onClick={()=>cont(a)} className="h-8 text-xs bg-orange-500 hover:bg-orange-600">Continue</Button>}
                            {canStartVisit && a.status==='completed' && a.visit_id && <Button size="sm" variant="outline" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-8 text-xs">View</Button>}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><button className="w-8 h-8 hover:bg-muted rounded flex items-center justify-center"><MoreVertical className="w-3.5 h-3.5"/></button></DropdownMenuTrigger>
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
              </div>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 mt-3">
                {stats.today_queue.map(a => (
                  <div key={a.id} className="border border-border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-[#0D9488] text-sm">{a.appointment_time}</span>
                          {statusBadge(a.status)}
                        </div>
                        <Link href={`/patients/${a.patient_id}`} className="font-medium text-sm hover:text-[#0D9488] block truncate">{a.patient_name||a.patient_name_temp}</Link>
                        <div className="text-xs text-muted-foreground mt-1 capitalize">{a.appointment_type?.replace('_',' ')}</div>
                        {a.doctor_name && <div className="text-xs text-muted-foreground">Dr. {a.doctor_name}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {a.status==='scheduled' && <Button size="sm" onClick={()=>setStatus(a.id,'arrived')} className="h-10 px-4 text-xs bg-blue-600 hover:bg-blue-700 flex-1">{!canStartVisit ? 'Check In' : 'Mark Arrived'}</Button>}
                      {canStartVisit && a.status==='arrived' && <Button size="sm" onClick={()=>startVisit(a)} className="h-10 px-4 text-xs bg-[#0D9488] hover:bg-[#0B7E73] flex-1">Start Visit</Button>}
                      {!canStartVisit && a.status==='arrived' && <span className="text-xs text-muted-foreground py-2">Waiting for doctor</span>}
                      {canStartVisit && a.status==='in_progress' && <Button size="sm" onClick={()=>cont(a)} className="h-10 px-4 text-xs bg-orange-500 hover:bg-orange-600 flex-1">Continue</Button>}
                      {canStartVisit && a.status==='completed' && a.visit_id && <Button size="sm" variant="outline" onClick={()=>router.push(`/visits/${a.visit_id}`)} className="h-10 px-4 text-xs flex-1">View</Button>}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button className="w-10 h-10 hover:bg-muted rounded flex items-center justify-center flex-shrink-0"><MoreVertical className="w-4 h-4"/></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={()=>setStatus(a.id,'cancelled')}>Cancel Appointment</DropdownMenuItem>
                          <DropdownMenuItem onClick={()=>setStatus(a.id,'no_show')}>Mark No Show</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
        )}
        <Card className={`${(showQueue || !showQueueToggle) ? 'lg:col-span-2' : 'lg:col-span-5'} p-4 md:p-6 bg-card border-border rounded-lg`}>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h3 className="font-semibold text-foreground text-base md:text-lg">Pending Follow-ups</h3>
            {stats?.followups?.length>0 && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Due Now</span>}
          </div>
          {stats?.followups?.length === 0 && <div className="text-sm text-muted-foreground py-4 md:py-6 text-center">No follow-ups pending</div>}
          {stats?.followups?.map(p => {
            const overdue = new Date(p.next_followup_date) < new Date()
            return (
              <div key={p.id} className="py-3 border-b border-border last:border-0">
                <div className="flex items-center justify-between">
                  <Link href={`/patients/${p.id}`} className="font-medium text-sm hover:text-[#0D9488] truncate flex-1">{p.name}</Link>
                  <span className={`text-xs ml-2 flex-shrink-0 ${overdue?'text-[#EF4444]':'text-success'}`}>{fmtDate(p.next_followup_date)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{p.last_visit_reason || '—'}</div>
                <div className="flex gap-2 mt-2">
                  <a href={`https://wa.me/91${p.phone}?text=${encodeURIComponent(`Hello ${p.name}, this is a reminder for your follow-up appointment at ${stats.clinic_name}. Please call us to book your visit.`)}`} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 h-9 rounded bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"><MessageCircle className="w-3 h-3"/>WhatsApp</a>
                  <button className="text-xs px-3 py-2 h-9 rounded bg-[#0D9488]/10 text-[#0D9488] hover:bg-[#0D9488]/20">Book Appointment</button>
                </div>
              </div>
            )
          })}
          {stats?.followups?.length>0 && <Link href="/patients" className="text-xs text-[#0D9488] hover:underline mt-3 inline-block">View all follow-ups →</Link>}
        </Card>
      </div>
      <BookAppointmentModal open={bookOpen} setOpen={setBookOpen} onCreated={load} />
      <OutstandingBalanceModal open={balanceModalOpen} onOpenChange={setBalanceModalOpen} patientId={selectedPatientId} />
    </div>
  )
}

function QuickSearchBar({ onBook, canStartVisit }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)
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
    <>
      <Card className="p-4 md:p-5 bg-card border-border rounded-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or phone number…" className="pl-9 h-11 text-base"/>
            {q && (
              <div className="absolute top-12 left-0 right-0 bg-card border border-border rounded-md shadow-lg z-10 max-h-96 overflow-y-auto">
                {results.length===0 ? <div className="p-3 text-sm flex items-center justify-between"><span className="text-muted-foreground">No patient found.</span>{canStartVisit && <Link href="/patients" className="text-[#0D9488] hover:underline flex items-center gap-1"><Plus className="w-3 h-3"/>Add New Patient</Link>}</div>
                 : results.map(p=>(
                  <button key={p.id} onClick={()=>router.push(`/patients/${p.id}`)} className="w-full text-left px-4 py-2.5 hover:bg-muted border-b border-border last:border-0 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="min-w-0"><div className="font-medium text-sm truncate">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></div>
                      <BalanceBadge
                        patientId={p.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPatientId(p.id)
                          setBalanceModalOpen(true)
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{p.last_visit_date ? `Last: ${fmtDate(p.last_visit_date)}` : 'No visits'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={onBook} className="bg-[#0D9488] hover:bg-[#0B7E73] h-11 px-4 sm:w-auto w-full"><Plus className="w-4 h-4 mr-1"/>Quick Book</Button>
        </div>
      </Card>
      <OutstandingBalanceModal open={balanceModalOpen} onOpenChange={setBalanceModalOpen} patientId={selectedPatientId} />
    </>
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
