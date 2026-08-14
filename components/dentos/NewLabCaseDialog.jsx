'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import PatientCombobox from '@/components/dentos/PatientCombobox'

export const CASE_TYPES = ['Crown', 'Bridge', 'Denture', 'Partial Denture', 'Implant Crown', 'Inlay/Onlay', 'Veneer', 'Aligner', 'Night Guard', 'Other']
export const MATERIALS = ['Zirconia', 'PFM (Porcelain Fused to Metal)', 'E-max / Lithium Disilicate', 'Full Metal', 'Acrylic', 'Composite', 'Cobalt-Chrome', 'Other']
export const URGENCIES = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
]

function Combobox({ items, value, onChange, placeholder, emptyText }) {
  const [open, setOpen] = useState(false)
  const selected = items.find(i => i.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder}/>
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map(i => (
                <CommandItem key={i.value} value={i.label} onSelect={()=>{ onChange(i.value); setOpen(false) }}>
                  <Check className={cn('mr-2 h-4 w-4', value === i.value ? 'opacity-100' : 'opacity-0')}/>
                  {i.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const EMPTY = { patient_id: '', vendor_id: '', case_type: '', tooth_numbers: '', shade: '', material: '', description: '', urgency: 'routine', expected_delivery_date: '' }

// Shared "New Lab Case" dialog. Pass `lockedPatient` (a patient object) to
// pre-fill and lock the patient field — used from the patient profile page.
export function NewLabCaseDialog({ open, setOpen, onCreated, lockedPatient = null, navigateOnCreate = true }) {
  const router = useRouter()
  const [f, setF] = useState(EMPTY)
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingRefs, setLoadingRefs] = useState(false)

  useEffect(() => {
    if (!open) return
    setF({ ...EMPTY, patient_id: lockedPatient?.id || '' })
    setLoadingRefs(true)
    fetch('/api/vendors')
      .then(r => r.json())
      .then(v => setVendors(v.vendors || []))
      .catch(() => {})
      .finally(() => setLoadingRefs(false))
  }, [open, lockedPatient])

  const vendorItems = vendors.map(v => ({ value: v.id, label: v.name }))

  const submit = async (e) => {
    e.preventDefault()
    if (!f.patient_id) { toast.error('Please select a patient'); return }
    if (!f.vendor_id) { toast.error('Please select a vendor'); return }
    if (!f.case_type) { toast.error('Please select a case type'); return }
    if (f.expected_delivery_date && isNaN(new Date(f.expected_delivery_date).getTime())) { toast.error('Invalid delivery date'); return }
    setLoading(true)
    const r = await fetch('/api/lab-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) {
      toast.success(`Lab case ${d.case_number} created`)
      setOpen(false)
      onCreated && onCreated(d)
      if (navigateOnCreate) router.push(`/lab-cases/${d.id}`)
    } else toast.error(d.error || 'Failed to create lab case')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Lab Case</DialogTitle></DialogHeader>
        {loadingRefs ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Patient <span className="text-[#EF4444]">*</span></Label>
              {lockedPatient ? (
                <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                  {lockedPatient.name}{lockedPatient.patient_code ? ` (${lockedPatient.patient_code})` : ''}
                </div>
              ) : (
                <PatientCombobox value={f.patient_id} onChange={v=>setF({...f,patient_id:v})} />
              )}
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Vendor / Lab <span className="text-[#EF4444]">*</span></Label>
              {vendors.length === 0
                ? <p className="text-xs text-muted-foreground border border-dashed rounded-md p-2.5">No vendors yet. <Link href="/vendors" className="text-[#0D9488] underline">Add a vendor</Link> first.</p>
                : <Combobox items={vendorItems} value={f.vendor_id} onChange={v=>setF({...f,vendor_id:v})} placeholder="Select vendor…" emptyText="No vendors found"/>}
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Case Type <span className="text-[#EF4444]">*</span></Label>
              <Select value={f.case_type} onValueChange={v=>setF({...f,case_type:v})}>
                <SelectTrigger><SelectValue placeholder="Select type"/></SelectTrigger>
                <SelectContent>{CASE_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Tooth Numbers</Label>
              <Input value={f.tooth_numbers} onChange={e=>setF({...f,tooth_numbers:e.target.value})} placeholder="e.g. 11, 12, 21"/>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Shade</Label>
              <Input value={f.shade} onChange={e=>setF({...f,shade:e.target.value})} placeholder="e.g. A2"/>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Material</Label>
              <Select value={f.material} onValueChange={v=>setF({...f,material:v})}>
                <SelectTrigger><SelectValue placeholder="Select material"/></SelectTrigger>
                <SelectContent>{MATERIALS.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Urgency</Label>
              <Select value={f.urgency} onValueChange={v=>setF({...f,urgency:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{URGENCIES.map(u=><SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={f.expected_delivery_date} onChange={e=>setF({...f,expected_delivery_date:e.target.value})}/>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description / Instructions</Label>
              <Textarea rows={3} value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Special instructions for the lab…"/>
            </div>
            <div className="col-span-2 flex justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}Create Lab Case
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default NewLabCaseDialog
