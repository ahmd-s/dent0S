'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function WalkInModal({ open, setOpen, date, onCreated }) {
  const [doctors, setDoctors] = useState([])
  const [chairs, setChairs] = useState([])
  const [pq, setPq] = useState('')
  const [pResults, setPresults] = useState([])
  const [picked, setPicked] = useState(null)
  const [walkin, setWalkin] = useState(false)
  const [walkinForm, setWalkinForm] = useState({ name: '', phone: '' })
  const [f, setF] = useState({ doctor_id: '', chair_id: '', chief_complaint: '', priority: 'normal' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      fetch('/api/doctors').then(r => r.json()).then(d => setDoctors(d.doctors || []))
      fetch('/api/chairs').then(r => r.json()).then(d => setChairs(d.chairs || []))
    }
  }, [open])

  useEffect(() => {
    if (!pq) { setPresults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/patients?q=${encodeURIComponent(pq)}`)
      const d = await r.json()
      setPresults((d.patients || []).slice(0, 5))
    }, 250)
    return () => clearTimeout(t)
  }, [pq])

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
    if (!patient_id && !walkinForm.name) { toast.error('Select a patient'); setBusy(false); return }

    const r = await fetch('/api/appointments/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'walk_in',
        date,
        patient_id,
        patient_name_temp: walkinForm.name,
        patient_phone_temp: walkinForm.phone,
        doctor_id: f.doctor_id || undefined,
        chair_id: f.chair_id || undefined,
        chief_complaint: f.chief_complaint,
        priority: f.priority,
      }),
    })
    setBusy(false)
    if (r.ok) {
      toast.success('Walk-in added to queue')
      setOpen(false)
      setPicked(null)
      setPq('')
      onCreated?.()
    } else toast.error('Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Walk-In</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Patient</Label>
            {picked ? (
              <div className="flex items-center justify-between p-2 border rounded-md bg-muted">
                <div><div className="font-medium text-sm">{picked.name}</div><div className="text-xs text-muted-foreground">+91 {picked.phone}</div></div>
                <button type="button" onClick={() => setPicked(null)} className="text-xs text-[#0D9488]">Change</button>
              </div>
            ) : walkin ? (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={walkinForm.name} onChange={e => setWalkinForm({ ...walkinForm, name: e.target.value })} />
                <Input placeholder="Phone" value={walkinForm.phone} onChange={e => setWalkinForm({ ...walkinForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                <button type="button" onClick={() => setWalkin(false)} className="col-span-2 text-xs text-[#0D9488] text-left">← Search existing</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search patient…" className="pl-9" />
                {pq && (
                  <div className="absolute top-11 left-0 right-0 bg-card border rounded-md shadow z-10 max-h-48 overflow-y-auto">
                    {pResults.map(p => (
                      <button key={p.id} type="button" onClick={() => { setPicked(p); setPq('') }} className="w-full text-left px-3 py-2 hover:bg-muted border-b text-sm">{p.name}</button>
                    ))}
                    <button type="button" onClick={() => { setWalkin(true); setPq('') }} className="w-full text-left px-3 py-2 text-[#0D9488] text-sm flex items-center gap-1"><Plus className="w-3 h-3" />New patient</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Select value={f.doctor_id} onValueChange={v => setF({ ...f, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chair</Label>
              <Select value={f.chair_id} onValueChange={v => setF({ ...f, chair_id: v })}>
                <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                <SelectContent>{chairs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Chief Complaint</Label>
            <Input value={f.chief_complaint} onChange={e => setF({ ...f, chief_complaint: e.target.value })} />
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy} className="bg-[#0D9488] hover:bg-[#0B7E73]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Queue'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
