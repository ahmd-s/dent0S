'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function BookForPatientModal({ open, setOpen, patient, onCreated }) {
  const [f, setF] = useState({ appointment_date: todayIso(), appointment_time: '10:00 AM', appointment_type: 'follow_up', chief_complaint: '' })

  const submit = async e => {
    e.preventDefault()
    const r = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, patient_id: patient.id }),
    })
    if (r.ok) { toast.success('Booked'); setOpen(false); onCreated?.() }
    else toast.error('Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Book for {patient.name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.appointment_date} onChange={e => setF({ ...f, appointment_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Time</Label><Input value={f.appointment_time} onChange={e => setF({ ...f, appointment_time: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={f.appointment_type} onValueChange={v => setF({ ...f, appointment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['new_patient', 'follow_up', 'emergency', 'consultation', 'procedure'].map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Chief Complaint</Label><Textarea rows={2} value={f.chief_complaint} onChange={e => setF({ ...f, chief_complaint: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="bg-[#0D9488] hover:bg-[#0B7E73]">Book</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
