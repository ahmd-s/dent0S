'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VisitVoiceRecorder } from '@/components/dentos/VisitVoiceRecorder'
import { VisitDocuments } from '@/components/dentos/VisitDocuments'
import ToothChart from '@/components/dentos/ToothChart'
import SmartTextarea from '@/components/SmartTextarea'
import { toast } from 'sonner'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : ''
const FREQS = ['OD','BD','TDS','QID','SOS','1-0-1','1-1-1','1-0-0','0-0-1']

function mergeTextBlock(prev, next) {
  const n = (next || '').trim()
  if (!n) return prev || ''
  const p = (prev || '').trim()
  if (!p) return n
  return `${p}\n\n${n}`
}

function mergeSingleLine(prev, next) {
  const n = (next || '').trim()
  if (!n) return prev || ''
  const p = (prev || '').trim()
  if (!p) return n
  return `${p}; ${n}`
}

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
  const [inventoryTemplates, setInventoryTemplates] = useState([])
  const [selectedTemplateMaterials, setSelectedTemplateMaterials] = useState([])
  const [showPrev, setShowPrev] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autosaveAt, setAutosaveAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [consumeModalOpen, setConsumeModalOpen] = useState(false)
  const [consumeItems, setConsumeItems] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [clinicName, setClinicName] = useState('')
  const [showToothChart, setShowToothChart] = useState(false)

  const stateRef = useRef({})
  stateRef.current = { v, rxs, items, discount, gstOn, paymentMode, paymentStatus, clinicName }

  const set = (k, val) => setV(p => ({...p, [k]: val}))

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/visits/${id}`)
    const d = await r.json()
    if (!r.ok) { toast.error('Visit not found'); setLoading(false); return }
    setV(d.visit); setRxs(d.visit.prescriptions || [])
    if (d.visit.invoice) {
      setItems(d.visit.invoice.items || [])
      setDiscount(d.visit.invoice.discount || 0)
      setGstOn(!!d.visit.invoice.gst_amount)
      setPaymentMode(d.visit.invoice.payment_mode || 'cash')
      setPaymentStatus(d.visit.invoice.payment_status || 'pending')
    }
    const meRes = await fetch('/api/auth/me')
    const meData = await meRes.json()
    setClinicName(meData.clinic?.name || '')
    setLoading(false)
  }
  useEffect(() => { if (id) load() }, [id])
  useEffect(() => { fetch('/api/inventory/templates').then(r=>r.json()).then(d=>setInventoryTemplates(d.templates||[])) }, [])
  useEffect(() => { fetch('/api/inventory').then(r=>r.json()).then(d=>setInventoryItems(d.items||[])) }, [])

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
    
    // Use selected template materials if available, otherwise show empty modal
    if (selectedTemplateMaterials.length > 0) {
      const suggestedItems = selectedTemplateMaterials.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        suggested_quantity: item.suggested_quantity,
        actual_quantity: item.suggested_quantity,
        unit: item.unit
      }))
      setConsumeItems(suggestedItems)
    } else {
      setConsumeItems([])
    }
    setConsumeModalOpen(true)
  }
  
  const confirmCompleteVisit = async (skipConsumption = false) => {
    setSaving(true)
    const cur = stateRef.current
    
    try {
      // If not skipping and has items, consume inventory
      if (!skipConsumption && consumeItems.length > 0) {
        const itemsToSend = consumeItems
          .filter(item => 
            item.actual_quantity > 0 && 
            item.actual_quantity !== '' && 
            item.actual_quantity !== null &&
            item.actual_quantity !== undefined
          )
          .map(item => ({
            item_id: item.item_id,
            quantity: Number(item.actual_quantity)
          }))

        // If no items with qty > 0, skip consume API call entirely
        if (itemsToSend.length === 0) {
          // Just complete the visit, skip inventory
        } else {
          // Call consume API with filtered items only
          try {
            const consumeRes = await fetch('/api/inventory/consume', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                visit_id: id,
                patient_name: cur.v.patient?.name || 'Unknown',
                items: itemsToSend
              })
            })
            if (consumeRes.ok) {
              toast.success('Stock deducted successfully')
            } else {
              toast.warning('Stock deduction failed, but visit will complete')
            }
          } catch (consumeError) {
            console.error('Consume API error:', consumeError)
            toast.warning('Stock deduction failed, but visit will complete')
          }
        }
      }
      
      // Always complete the visit regardless of consume result
      const r = await fetch(`/api/visits/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...cur.v, prescriptions: cur.rxs, invoice_items: cur.items, discount: cur.discount, gst_enabled: cur.gstOn, payment_mode: cur.paymentMode, payment_status: cur.paymentStatus, complete: true }) })
      if (r.ok) { 
        toast.success('Visit completed!', {
          description: 'Send visit summary to patient on WhatsApp?',
          action: {
            label: 'Send WhatsApp',
            onClick: () => {
              const summaryUrl = `https://www.dent-os.in/visit-summary/${id}`
              const treatment = cur.v.treatment_done || 'Dental treatment'
              const msg = `Hello ${cur.v.patient?.name || 'Patient'}! 🦷\n\nThank you for visiting ${cur.clinicName}.\n\nTreatment: ${treatment}\n\n💊 Prescription & Invoice:\n${summaryUrl}\n\n— ${cur.clinicName}`
              const waUrl = `https://wa.me/91${cur.v.patient?.phone}?text=${encodeURIComponent(msg)}`
              window.open(waUrl, '_blank')
            }
          },
          duration: 10000
        })
        setTimeout(() => router.push(`/patients/${cur.v.patient_id}`), 500)
      } else {
        toast.error('Failed to complete visit')
      }
    } finally {
      setSaving(false)
      setConsumeModalOpen(false)
    }
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
  const applyInventoryTemplate = (template) => {
    const currentTreatment = v.treatment_done || ''
    const newTreatment = currentTreatment.trim() ? `${currentTreatment}\n${template.treatment_name}` : template.treatment_name
    set('treatment_done', newTreatment)
    setSelectedTemplateMaterials(template.items || [])
    toast.success(`Applied: ${template.treatment_name} — materials ready for stock deduction`)
  }

  const handleVoiceApply = useCallback(({ fields }) => {
    if (!fields || typeof fields !== 'object') return
    setV(prev => ({
      ...prev,
      chief_complaint: mergeTextBlock(prev.chief_complaint, fields.chief_complaint),
      clinical_notes: mergeTextBlock(prev.clinical_notes, fields.clinical_notes),
      diagnosis: mergeSingleLine(prev.diagnosis, fields.diagnosis),
      treatment_done: mergeTextBlock(prev.treatment_done, fields.treatment_done),
    }))
    const rxList = Array.isArray(fields.prescriptions) ? fields.prescriptions : []
    const valid = rxList.filter(p => p && String(p.medicine_name || '').trim())
    if (valid.length) {
      setRxs(prev => [
        ...prev,
        ...valid.map((p, i) => ({
          id: `tmp_voice_${Date.now()}_${i}`,
          medicine_name: String(p.medicine_name || '').trim(),
          dosage: String(p.dosage || '').trim(),
          frequency: FREQS.includes(p.frequency) ? p.frequency : 'OD',
          duration: String(p.duration || '').trim(),
          instructions: String(p.instructions || '').trim(),
        })),
      ])
    }
  }, [])

  const handleAddToFindings = (findings) => {
    setV(prev => ({
      ...prev,
      clinical_notes: prev.clinical_notes ? `${prev.clinical_notes}\n\n${findings}` : findings
    }))
  }

  const subtotal = items.reduce((s,it) => s + (parseFloat(it.unit_price)||0)*(parseInt(it.quantity)||1), 0)
  const gst = gstOn ? Math.round((subtotal-discount)*0.18*100)/100 : 0
  const total = Math.max(0, subtotal - discount + gst)

  if (loading) return (
    <div className="max-w-5xl mx-auto pb-12 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-muted rounded w-32 animate-pulse"/>
        <div className="flex gap-2">
          <div className="h-10 bg-muted rounded w-24 animate-pulse"/>
          <div className="h-10 bg-muted rounded w-32 animate-pulse"/>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-muted rounded w-48 animate-pulse"/>
          <div className="h-4 bg-muted rounded w-32 animate-pulse"/>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded w-24 animate-pulse"/>
          <div className="h-24 bg-muted rounded animate-pulse"/>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded w-24 animate-pulse"/>
          <div className="h-24 bg-muted rounded animate-pulse"/>
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded w-32 animate-pulse"/>
        <div className="h-32 bg-muted rounded animate-pulse"/>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded w-32 animate-pulse"/>
        <div className="h-32 bg-muted rounded animate-pulse"/>
      </div>
    </div>
  )

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

      <VisitVoiceRecorder visitId={id} disabled={saving} onApplyExtraction={handleVoiceApply} />

      <Card className="mt-5 bg-white border-border rounded-lg">
        <button type="button" onClick={()=>setShowToothChart(s=>!s)} className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-gray-50 transition-colors">
          <span className="flex items-center gap-2">🦷 Tooth Chart</span>
          {showToothChart ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </button>
        {showToothChart && <div className="px-4 pb-4">
          <ToothChart visitId={id} patientId={v.patient_id} readOnly={saving} />
        </div>}
      </Card>

      <Card className="mt-5 p-6 bg-white border-border rounded-lg space-y-5">
        <div className="space-y-1.5"><Label className="text-base">Chief Complaint <span className="text-[#EF4444]">*</span></Label><SmartTextarea value={v.chief_complaint||''} onChange={val=>set('chief_complaint',val)} category="chief_complaints" placeholder="What brings the patient in today?" rows={2}/></div>
        <div className="space-y-1.5"><Label className="text-base">Examination Findings</Label><SmartTextarea value={v.clinical_notes||''} onChange={val=>set('clinical_notes',val)} category="clinical_findings" placeholder="Document your examination findings…" rows={3}/></div>
        <div className="space-y-1.5"><Label className="text-base">Diagnosis</Label><Input value={v.diagnosis||''} onChange={e=>set('diagnosis',e.target.value)} placeholder="e.g. Deep caries 46, Gingivitis"/></div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-base">Treatment Done</Label>
            {inventoryTemplates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline" className="h-7 text-xs">Apply Template</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  {inventoryTemplates.map(t => <DropdownMenuItem key={t.id} onClick={()=>applyInventoryTemplate(t)}><div className="font-medium">{t.treatment_name}</div></DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <Textarea value={v.treatment_done||''} onChange={e=>set('treatment_done',e.target.value)} placeholder="Describe the treatment performed..." rows={3}/>
        </div>
        <div className="space-y-1.5"><Label className="text-base">Plan for Next Visit</Label><SmartTextarea value={v.treatment_plan||''} onChange={val=>set('treatment_plan',val)} category="treatment_plans" placeholder="What should be done on the next visit…" rows={2}/></div>
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

      <Card className="mt-5 p-6 bg-white border-border rounded-lg">
        <Label className="text-base mb-3 block">Documents & Scans</Label>
        <VisitDocuments visitId={id} patientId={v.patient_id} onAddFindings={handleAddToFindings} />
      </Card>

      <ConsumptionModal 
        open={consumeModalOpen} 
        setOpen={setConsumeModalOpen} 
        items={consumeItems} 
        setItems={setConsumeItems}
        inventoryItems={inventoryItems}
        onConfirm={() => confirmCompleteVisit(false)}
        onSkip={() => confirmCompleteVisit(true)}
      />
    </div>
  )
}

function ConsumptionModal({ open, setOpen, items, setItems, inventoryItems, onConfirm, onSkip }) {
  const [loading, setLoading] = useState(false)

  const addUnlistedItem = () => {
    setItems([...items, { item_id: '', item_name: '', suggested_quantity: 1, actual_quantity: 1, unit: '' }])
  }

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx, field, value) => {
    const newItems = [...items]
    newItems[idx][field] = value
    if (field === 'item_id') {
      const item = inventoryItems.find(i => i.id === value)
      newItems[idx].item_name = item?.item_name || ''
      newItems[idx].unit = item?.unit || ''
    }
    setItems(newItems)
  }

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  const handleSkip = async () => {
    setLoading(true)
    await onSkip()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Material Consumption</DialogTitle>
          <p className="text-sm text-muted-foreground">Review materials used for this visit. All quantities can be adjusted.</p>
        </DialogHeader>
        
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No materials suggested. Add manually if needed.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 border border-border rounded-lg">
                  <div className="flex-1">
                    <select 
                      value={item.item_id} 
                      onChange={e => updateItem(idx, 'item_id', e.target.value)}
                      className="w-full border border-input rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select material</option>
                      {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <Input 
                      type="number" 
                      value={item.actual_quantity} 
                      onChange={e => updateItem(idx, 'actual_quantity', parseInt(e.target.value) || 0)}
                      min="0"
                      className="text-sm"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12">{item.unit}</span>
                  <button 
                    type="button" 
                    onClick={() => removeItem(idx)}
                    className="w-7 h-7 rounded hover:bg-red-50 flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500"/>
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addUnlistedItem} className="w-full">+ Add Unlisted Material</Button>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={handleSkip} disabled={loading}>Skip — Don't Log</Button>
          <Button type="button" onClick={handleConfirm} disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Confirm & Deduct Stock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default App
