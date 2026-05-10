'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Check, Loader2, Plus, Trash2, AlertTriangle, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : ''
const FREQS = ['OD','BD','TDS','QID','SOS','1-0-1','1-1-1','1-0-0','0-0-1']

function App() {
  const { id } = useParams()
  const router = useRouter()
  const [v, setV] = useState(null)
  const [rxs, setRxs] = useState([])
  const [items, setItems] = useState([])
  const [discount, setDiscount] = useState(0)
  const [gstOn, setGstOn] = useState(false)
  const [paymentMode, setPaymentMode] = useState('cash')
  const [paymentStatus, setPaymentStatus] = useState('pending')
  const [templates, setTemplates] = useState([])
  const [showPrev, setShowPrev] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autosaveAt, setAutosaveAt] = useState(null)

  const stateRef = useRef({})
  stateRef.current = { v, rxs, items, discount, gstOn, paymentMode, paymentStatus }

  const set = (k, val) => setV(p => ({...p, [k]: val}))

  const load = async () => {
    const r = await fetch(`/api/visits/${id}`)
    const d = await r.json()
    if (!r.ok) { toast.error('Visit not found'); return }
    setV(d.visit); setRxs(d.visit.prescriptions || [])
    if (d.visit.invoice) {
      setItems(d.visit.invoice.items || [])
      setDiscount(d.visit.invoice.discount || 0)
      setGstOn(!!d.visit.invoice.gst_amount)
      setPaymentMode(d.visit.invoice.payment_mode || 'cash')
      setPaymentStatus(d.visit.invoice.payment_status || 'pending')
    }
  }
  useEffect(() => { if (id) load() }, [id])
  useEffect(() => { fetch('/api/treatment_templates').then(r=>r.json()).then(d=>setTemplates(d.templates||[])) }, [])

  const saveDraft = async (silent=false) => {
    if (!stateRef.current.v) return
    setSaving(true)
    const cur = stateRef.current
    const r = await fetch(`/api/visits/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...cur.v, prescriptions: cur.rxs, invoice_items: cur.items, discount: cur.discount, gst_enabled: cur.gstOn, payment_mode: cur.paymentMode, payment_status: cur.paymentStatus, complete: false }) })
    setSaving(false)
    if (r.ok) { if (!silent) toast.success('Draft saved'); setAutosaveAt(new Date()) }
    else if (!silent) toast.error('Save failed')
  }
  const completeVisit = async () => {
    if (!stateRef.current.v?.chief_complaint?.trim()) { toast.error('Chief complaint is required'); return }
    setSaving(true)
    const cur = stateRef.current
    const r = await fetch(`/api/visits/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...cur.v, prescriptions: cur.rxs, invoice_items: cur.items, discount: cur.discount, gst_enabled: cur.gstOn, payment_mode: cur.paymentMode, payment_status: cur.paymentStatus, complete: true }) })
    setSaving(false)
    if (r.ok) { toast.success('Visit completed and invoice saved'); router.push(`/patients/${cur.v.patient_id}`) }
    else toast.error('Failed')
  }
  // autosave every 90s
  useEffect(() => {
    if (!v) return
    const i = setInterval(() => saveDraft(true), 90000)
    return () => clearInterval(i)
  }, [v])

  const addRx = () => setRxs(p => [...p, { id:'tmp_'+Date.now(), medicine_name:'', dosage:'', frequency:'OD', duration:'', instructions:'' }])
  const updateRx = (i,k,val) => setRxs(p => p.map((r,j) => j===i?{...r,[k]:val}:r))
  const removeRx = i => setRxs(p => p.filter((_,j) => j!==i))
  const addItem = (desc='', price=0) => setItems(p => [...p, { id:'tmp_'+Date.now(), description:desc, quantity:1, unit_price:price }])
  const updateItem = (i,k,val) => setItems(p => p.map((r,j) => j===i?{...r,[k]:val}:r))
  const removeItem = i => setItems(p => p.filter((_,j) => j!==i))
  const applyTemplate = t => {
    set('treatment_done', (v.treatment_done? v.treatment_done+'\n':'') + (t.default_notes||t.name))
    if (t.default_price > 0) addItem(t.name, t.default_price)
    toast.success(`Applied: ${t.name}`)
  }

  const subtotal = items.reduce((s,it) => s + (parseFloat(it.unit_price)||0)*(parseInt(it.quantity)||1), 0)
  const gst = gstOn ? Math.round((subtotal-discount)*0.18*100)/100 : 0
  const total = Math.max(0, subtotal - discount + gst)

  if (!v) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <Link href={`/patients/${v.patient_id}`} className="text-sm text-muted-foreground hover:text-[#0D9488] flex items-center gap-1"><ArrowLeft className="w-4 h-4"/>{v.patient?.name || 'Patient'}</Link>
        <div className="flex items-center gap-2">
          {autosaveAt && <span className="text-xs text-muted-foreground mr-1">Auto-saved {autosaveAt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</span>}
          <Button variant="outline" onClick={()=>saveDraft(false)} disabled={saving}>{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<><Save className="w-4 h-4 mr-2"/>Save Draft</>}</Button>
          <Button onClick={completeVisit} disabled={saving} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Check className="w-4 h-4 mr-2"/>Complete Visit</Button>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-3">{v.patient?.name}
            {v.patient?.age && <span className="text-base font-normal text-muted-foreground">· {v.patient.age} yrs</span>}
            {v.patient?.blood_group && <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium">{v.patient.blood_group}</span>}
          </h1>
          <p className="text-sm text-muted-foreground">Visit on {fmtDate(v.visit_date)}</p>
        </div>
      </div>

      {v.patient?.allergies && (
        <div className="mt-4 p-3 bg-red-50 border-2 border-red-300 rounded-md flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0"/>
          <div className="text-sm"><span className="font-bold text-[#EF4444]">ALLERGY ALERT:</span> <span className="text-red-900">{v.patient.allergies}</span></div>
        </div>
      )}
      {v.previous_visit && (
        <Card className="mt-4 p-4 bg-[#F8FAFC] border-border rounded-lg">
          <button type="button" onClick={()=>setShowPrev(s=>!s)} className="w-full flex items-center justify-between text-sm font-medium">
            <span><FileText className="w-4 h-4 inline mr-2"/>Last Visit: {fmtDate(v.previous_visit.visit_date)} — {v.previous_visit.treatment_done?.slice(0,80) || v.previous_visit.diagnosis?.slice(0,80) || 'No notes'}</span>
            {showPrev ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
          </button>
          {showPrev && <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
            {v.previous_visit.chief_complaint && <div><span className="text-xs text-muted-foreground">Chief Complaint</span><div>{v.previous_visit.chief_complaint}</div></div>}
            {v.previous_visit.diagnosis && <div><span className="text-xs text-muted-foreground">Diagnosis</span><div>{v.previous_visit.diagnosis}</div></div>}
            {v.previous_visit.treatment_done && <div><span className="text-xs text-muted-foreground">Treatment Done</span><div className="whitespace-pre-line">{v.previous_visit.treatment_done}</div></div>}
            {v.previous_visit.treatment_plan && <div><span className="text-xs text-muted-foreground">Plan</span><div className="whitespace-pre-line">{v.previous_visit.treatment_plan}</div></div>}
          </div>}
        </Card>
      )}

      <Card className="mt-5 p-6 bg-white border-border rounded-lg space-y-5">
        <div className="space-y-1.5"><Label className="text-base">Chief Complaint <span className="text-[#EF4444]">*</span></Label><Textarea rows={2} value={v.chief_complaint||''} onChange={e=>set('chief_complaint',e.target.value)} placeholder="What brings the patient in today?"/></div>
        <div className="space-y-1.5"><Label className="text-base">Examination Findings</Label><Textarea rows={3} value={v.clinical_notes||''} onChange={e=>set('clinical_notes',e.target.value)} placeholder="Document your examination findings…"/></div>
        <div className="space-y-1.5"><Label className="text-base">Diagnosis</Label><Input value={v.diagnosis||''} onChange={e=>set('diagnosis',e.target.value)} placeholder="e.g. Deep caries 46, Gingivitis"/></div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-base">Treatment Done</Label>
            {templates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline" className="h-7 text-xs">Apply Template</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  {templates.map(t => <DropdownMenuItem key={t.id} onClick={()=>applyTemplate(t)}><div><div className="font-medium">{t.name}</div>{t.default_price>0 && <div className="text-xs text-muted-foreground">₹{t.default_price}</div>}</div></DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <Textarea rows={3} value={v.treatment_done||''} onChange={e=>set('treatment_done',e.target.value)}/>
        </div>
        <div className="space-y-1.5"><Label className="text-base">Plan for Next Visit</Label><Textarea rows={2} value={v.treatment_plan||''} onChange={e=>set('treatment_plan',e.target.value)} placeholder="What should be done on the next visit…"/></div>
      </Card>

      <Card className="mt-5 p-6 bg-white border-border rounded-lg">
        <div className="flex items-center justify-between mb-3"><Label className="text-base">Prescriptions</Label><Button type="button" size="sm" variant="outline" onClick={addRx}><Plus className="w-4 h-4 mr-1"/>Add Medicine</Button></div>
        {rxs.length === 0 && <div className="text-sm text-muted-foreground py-2">No prescriptions added</div>}
        {rxs.map((r,i) => (
          <div key={r.id} className="grid grid-cols-12 gap-2 mb-2">
            <Input className="col-span-3" placeholder="Medicine" value={r.medicine_name} onChange={e=>updateRx(i,'medicine_name',e.target.value)}/>
            <Input className="col-span-2" placeholder="500mg" value={r.dosage} onChange={e=>updateRx(i,'dosage',e.target.value)}/>
            <Select value={r.frequency} onValueChange={v=>updateRx(i,'frequency',v)}><SelectTrigger className="col-span-2"><SelectValue/></SelectTrigger><SelectContent>{FREQS.map(fr=><SelectItem key={fr} value={fr}>{fr}</SelectItem>)}</SelectContent></Select>
            <Input className="col-span-2" placeholder="5 days" value={r.duration} onChange={e=>updateRx(i,'duration',e.target.value)}/>
            <Input className="col-span-2" placeholder="After food" value={r.instructions} onChange={e=>updateRx(i,'instructions',e.target.value)}/>
            <button type="button" onClick={()=>removeRx(i)} className="col-span-1 hover:bg-red-50 rounded flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-500"/></button>
          </div>
        ))}
      </Card>

      <Card className="mt-5 p-6 bg-white border-border rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <Switch checked={!!v.next_visit_recommended} onCheckedChange={val=>set('next_visit_recommended', val)} />
          <Label className="!mt-0 text-base">Recommend follow-up visit?</Label>
        </div>
        {v.next_visit_recommended && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Next Visit Date</Label><Input type="date" value={v.next_visit_date||''} onChange={e=>set('next_visit_date',e.target.value)}/></div>
            <div className="space-y-1.5"><Label>Notes for next visit</Label><Input value={v.next_visit_notes||''} onChange={e=>set('next_visit_notes',e.target.value)} placeholder="e.g. RCT continuation"/></div>
          </div>
        )}
      </Card>

      <Card className="mt-5 p-6 bg-white border-border rounded-lg">
        <div className="flex items-center justify-between mb-3"><Label className="text-base">Invoice for This Visit</Label><Button type="button" size="sm" variant="outline" onClick={()=>addItem()}><Plus className="w-4 h-4 mr-1"/>Add Item</Button></div>
        {items.length === 0 && <div className="text-sm text-muted-foreground py-2">No items added. Click “Apply Template” above or add items manually.</div>}
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs uppercase text-muted-foreground tracking-wider"><div className="col-span-6">Description</div><div className="col-span-2">Qty</div><div className="col-span-2">Unit Price</div><div className="col-span-1 text-right">Total</div><div className="col-span-1"/></div>
            {items.map((it,i) => {
              const t = (parseFloat(it.unit_price)||0)*(parseInt(it.quantity)||1)
              return (
                <div key={it.id} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-6" value={it.description} onChange={e=>updateItem(i,'description',e.target.value)} placeholder="e.g. Composite filling"/>
                  <Input className="col-span-2" type="number" min="1" value={it.quantity} onChange={e=>updateItem(i,'quantity',e.target.value)}/>
                  <Input className="col-span-2" type="number" min="0" step="0.01" value={it.unit_price} onChange={e=>updateItem(i,'unit_price',e.target.value)}/>
                  <div className="col-span-1 text-right text-sm font-medium pt-2">₹{t.toLocaleString('en-IN')}</div>
                  <button type="button" onClick={()=>removeItem(i)} className="col-span-1 hover:bg-red-50 rounded flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-500"/></button>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-5 pt-4 border-t border-border space-y-2 max-w-sm ml-auto text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between items-center"><span className="text-muted-foreground">Discount</span><Input type="number" value={discount} onChange={e=>setDiscount(parseFloat(e.target.value)||0)} className="w-24 h-8 text-right"/></div>
          <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Switch checked={gstOn} onCheckedChange={setGstOn}/><span className="text-muted-foreground">GST (18%)</span></div><span>₹{gst.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between pt-2 border-t border-border text-lg font-bold"><span>Total</span><span>₹{total.toLocaleString('en-IN')}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
          <div className="space-y-1.5"><Label>Payment Mode</Label><Select value={paymentMode} onValueChange={setPaymentMode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['cash','upi','card','net_banking','free'].map(p=><SelectItem key={p} value={p} className="capitalize">{p.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Payment Status</Label><Select value={paymentStatus} onValueChange={setPaymentStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="waived">Waived</SelectItem></SelectContent></Select></div>
        </div>
      </Card>
    </div>
  )
}
export default App
