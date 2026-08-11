'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import ConflictWarnings from './ConflictWarnings'

const TYPES = ['new_patient', 'follow_up', 'emergency', 'consultation', 'procedure']

export default function NewAppointmentModal({ open, setOpen, initialDate, onCreated, prefillPatient, chairs = [], doctors: doctorsProp = [] }) {
  const [doctors, setDoctors] = useState(doctorsProp)
  const [chairList, setChairList] = useState(chairs)
  const [pq, setPq] = useState('')
  const [pResults, setPresults] = useState([])
  const [picked, setPicked] = useState(null)
  const [walkin, setWalkin] = useState(false)
  const [walkinForm, setWalkinForm] = useState({ name: '', phone: '' })
  const [f, setF] = useState({
    doctor_id: '', chair_id: '', appointment_date: initialDate,
    appointment_time: '10:00 AM', duration_minutes: 30,
    appointment_type: 'consultation', chief_complaint: '', notes: '',
    booked_via: 'in_clinic', priority: 'normal', status: 'scheduled',
  })
  const [conflicts, setConflicts] = useState([])
  const [warnings, setWarnings] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      if (!doctorsProp.length) fetch('/api/doctors').then(r => r.json()).then(d => setDoctors(d.doctors || []))
      else setDoctors(doctorsProp)
      if (!chairs.length) fetch('/api/chairs').then(r => r.json()).then(d => setChairList(d.chairs || []))
      else setChairList(chairs)
      setF(p => ({ ...p, appointment_date: initialDate }))
    }
  }, [open, initialDate, doctorsProp, chairs])

  useEffect(() => {
    if (open && prefillPatient) setPicked(prefillPatient)
    else if (open && !prefillPatient) setPicked(null)
  }, [open, prefillPatient])

  useEffect(() => {
    if (!pq) { setPresults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/patients?q=${encodeURIComponent(pq)}`)
      const d = await r.json()
      setPresults((d.patients || []).slice(0, 5))
    }, 250)
    return () => clearTimeout(t)
  }, [pq])

  useEffect(() => {
    if (!f.doctor_id || !f.appointment_date || !f.appointment_time) { setConflicts([]); setWarnings([]); return }
    const params = new URLSearchParams({
      doctor_id: f.doctor_id,
      date: f.appointment_date,
      time: f.appointment_time,
      duration: String(f.duration_minutes),
    })
    if (f.chair_id) params.set('chair_id', f.chair_id)
    fetch(`/api/appointments/conflicts?${params}`).then(r => r.json()).then(d => {
      setConflicts(d.conflicts || [])
      setWarnings(d.warnings || [])
    })
  }, [f.doctor_id, f.chair_id, f.appointment_date, f.appointment_time, f.duration_minutes])

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    let patient_id = picked?.id || null
    if (walkin && walkinForm.name && walkinForm.phone) {
      if (!/^\d{10}$/.test(walkinForm.phone)) { toast.error('Phone must be 10 digits'); setBusy(false); return }
      const r = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: walkinForm.name, phone: walkinForm.phone }) })
      const d = await r.json()
      if (r.ok) patient_id = d.id
      else { toast.error('Failed to create patient'); setBusy(false); return }
    }
    if (!patient_id) { toast.error('Select a patient'); setBusy(false); return }

    const r = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, patient_id, chair_id: f.chair_id || null }),
    })
    setBusy(false)
    if (r.ok) {
      toast.success(`Appointment booked${picked ? ` for ${picked.name}` : ''}`)
      setOpen(false)
      setPicked(null)
      setPq('')
      setWalkin(false)
      setWalkinForm({ name: '', phone: '' })
      onCreated?.()
    } else if (r.status === 409) {
      const d = await r.json()
      toast.error(d.message || 'Slot already booked')
    } else toast.error('Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Book Appointment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Patient</Label>
            {picked ? (
              <div className="flex items-center justify-between p-2 px-3 border rounded-md bg-muted">
                <div><div className="font-medium text-sm">{picked.name}</div><div className="text-xs text-muted-foreground">+91 {picked.phone}</div></div>
                <button type="button" onClick={() => setPicked(null)} className="text-xs text-[#0D9488] hover:underline">Change</button>
              </div>
            ) : walkin ? (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Patient name" value={walkinForm.name} onChange={e => setWalkinForm({ ...walkinForm, name: e.target.value })} />
                <Input placeholder="Phone (10 digits)" value={walkinForm.phone} onChange={e => setWalkinForm({ ...walkinForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                <button type="button" onClick={() => setWalkin(false)} className="col-span-2 text-xs text-[#0D9488] hover:underline text-left">← Search existing patient</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={pq} onChange={e => setPq(e.target.value)} placeholder="Type name or phone…" className="pl-9" />
                {pq && (
                  <div className="absolute top-11 left-0 right-0 bg-card border rounded-md shadow z-10 max-h-60 overflow-y-auto">
                    {pResults.map(p => (
                      <button key={p.id} type="button" onClick={() => { setPicked(p); setPq('') }} className="w-full text-left px-3 py-2 hover:bg-muted border-b text-sm">
                        <div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div>
                      </button>
                    ))}
                    <button type="button" onClick={() => { setWalkin(true); setPq('') }} className="w-full text-left px-3 py-2 hover:bg-[#0D9488]/5 text-[#0D9488] text-sm flex items-center gap-1"><Plus className="w-3 h-3" />Create New Patient</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Select value={f.doctor_id} onValueChange={v => setF({ ...f, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>{doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chair</Label>
              <Select value={f.chair_id} onValueChange={v => setF({ ...f, chair_id: v })}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{chairList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={f.appointment_type} onValueChange={v => setF({ ...f, appointment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={f.priority} onValueChange={v => setF({ ...f, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.appointment_date} onChange={e => setF({ ...f, appointment_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Time</Label><Input value={f.appointment_time} onChange={e => setF({ ...f, appointment_time: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={String(f.duration_minutes)} onValueChange={v => setF({ ...f, duration_minutes: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[15, 30, 45, 60, 90].map(d => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Booked Via</Label>
              <Select value={f.booked_via} onValueChange={v => setF({ ...f, booked_via: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_clinic">In-Clinic</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Chief Complaint</Label><Input value={f.chief_complaint} onChange={e => setF({ ...f, chief_complaint: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
          <ConflictWarnings conflicts={conflicts} warnings={warnings} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy} className="bg-[#0D9488] hover:bg-[#0B7E73]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Book Appointment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
