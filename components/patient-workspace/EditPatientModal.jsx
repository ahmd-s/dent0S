'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function EditPatientModal({ open, setOpen, patient, onSaved, clinicalLocked }) {
  const [f, setF] = useState(patient)
  useEffect(() => setF(patient), [patient])
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    const body = { ...f }
    if (clinicalLocked) {
      delete body.allergies
      delete body.medical_history
    }
    const r = await fetch(`/api/patients/${patient.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (r.ok) { toast.success('Saved'); setOpen(false); onSaved?.() }
    else toast.error('Failed')
  }

  if (!f) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Patient</DialogTitle></DialogHeader>
        {clinicalLocked && (
          <p className="text-xs text-muted-foreground -mt-1 mb-2">Allergies and medical history can only be updated by a doctor or admin.</p>
        )}
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2"><Label>Full Name</Label><Input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone || ''} onChange={e => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
          <div className="space-y-1.5"><Label>Age</Label><Input type="number" value={f.age || ''} onChange={e => setF({ ...f, age: e.target.value ? parseInt(e.target.value) : null })} /></div>
          <div className="space-y-1.5"><Label>Gender</Label>
            <Select value={f.gender || ''} onValueChange={v => setF({ ...f, gender: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Blood Group</Label>
            <Select value={f.blood_group || ''} onValueChange={v => setF({ ...f, blood_group: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!clinicalLocked && (
            <>
              <div className="space-y-1.5 col-span-2"><Label className="text-[#EF4444]">Allergies</Label><Textarea rows={2} value={f.allergies || ''} onChange={e => setF({ ...f, allergies: e.target.value })} /></div>
              <div className="space-y-1.5 col-span-2"><Label>Medical History</Label><Textarea rows={2} value={f.medical_history || ''} onChange={e => setF({ ...f, medical_history: e.target.value })} /></div>
            </>
          )}
          <div className="space-y-1.5 col-span-2"><Label>Address</Label><Textarea rows={2} value={f.address || ''} onChange={e => setF({ ...f, address: e.target.value })} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Referral Source</Label><Input value={f.referral_source || ''} onChange={e => setF({ ...f, referral_source: e.target.value })} placeholder="e.g. Google, Friend referral" /></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
