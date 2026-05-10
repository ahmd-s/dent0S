'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const todayIso = () => new Date().toISOString().slice(0,10)
const fmtDate = d => { const x = new Date(d); return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}` }
const STATUS = ['scheduled','arrived','in_progress','completed','cancelled','no_show']
const TYPES = ['new_patient','follow_up','emergency','consultation','procedure']

function App() {
  const [date, setDate] = useState(todayIso())
  const [list, setList] = useState([])
  const [patients, setPatients] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState({ patient_id:'', appointment_date: todayIso(), appointment_time:'10:00 AM', appointment_type:'consultation', chief_complaint:'', notes:'' })
  useEffect(() => {
    const url = new URL(window.location.href)
    const pid = url.searchParams.get('patient')
    if (pid) { setF(p => ({...p, patient_id: pid})); setOpen(true) }
  }, [])
  const load = async () => { const r = await fetch(`/api/appointments?date=${date}`); const d = await r.json(); setList(d.appointments||[]) }
  useEffect(() => { load() }, [date])
  useEffect(() => { fetch('/api/patients').then(r=>r.json()).then(d=>setPatients(d.patients||[])) }, [open])
  const submit = async e => {
    e.preventDefault()
    if (!f.patient_id) { toast.error('Select patient'); return }
    setLoading(true)
    const r = await fetch('/api/appointments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(f) })
    setLoading(false)
    if (r.ok) { toast.success('Booked'); setOpen(false); load() } else toast.error('Failed')
  }
  const updateStatus = async (id, status) => { const r = await fetch(`/api/appointments/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) }); if (r.ok) { toast.success('Updated'); load() } }
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{fmtDate(date)} · {list.length} scheduled</p>
        <div className="flex gap-3">
          <Input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-44"/>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>New</Button></DialogTrigger>
            <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Book Appointment</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5"><Label>Patient</Label><Select value={f.patient_id} onValueChange={v=>setF({...f,patient_id:v})}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{patients.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · +91 {p.phone}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.appointment_date} onChange={e=>setF({...f,appointment_date:e.target.value})}/></div><div className="space-y-1.5"><Label>Time</Label><Input value={f.appointment_time} onChange={e=>setF({...f,appointment_time:e.target.value})}/></div></div>
                <div className="space-y-1.5"><Label>Type</Label><Select value={f.appointment_type} onValueChange={v=>setF({...f,appointment_type:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TYPES.map(t=><SelectItem key={t} value={t} className="capitalize">{t.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Chief Complaint</Label><Textarea rows={2} value={f.chief_complaint} onChange={e=>setF({...f,chief_complaint:e.target.value})}/></div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Book'}</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="mt-6 bg-white border-border rounded-lg overflow-hidden">
        {list.length===0 && <div className="py-12 text-center text-muted-foreground text-sm">No appointments on {fmtDate(date)}</div>}
        {list.map(a => (
          <div key={a.id} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-0">
            <div className="w-20 text-sm font-semibold text-[#0D9488] flex items-center gap-1"><Clock className="w-3.5 h-3.5"/>{a.appointment_time}</div>
            <div className="flex-1"><Link href={`/patients/${a.patient_id}`} className="font-medium hover:text-[#0D9488]">{a.patient_name||a.patient_name_temp}</Link><div className="text-xs text-muted-foreground capitalize">{a.appointment_type?.replace('_',' ')} · {a.chief_complaint||'No complaint'} · Dr. {a.doctor_name||'—'}</div></div>
            <Select value={a.status} onValueChange={v=>updateStatus(a.id, v)}><SelectTrigger className="w-40 h-9"><SelectValue/></SelectTrigger><SelectContent>{STATUS.map(s=><SelectItem key={s} value={s} className="capitalize">{s.replace('_',' ')}</SelectItem>)}</SelectContent></Select>
          </div>
        ))}
      </Card>
    </div>
  )
}
export default App
