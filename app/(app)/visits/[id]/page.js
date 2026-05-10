'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

function App() {
  const { id } = useParams()
  const router = useRouter()
  const [v, setV] = useState(null)
  const [rxs, setRxs] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k,val) => setV(p => ({...p, [k]: val}))

  const load = async () => {
    const r = await fetch(`/api/visits/${id}`)
    const d = await r.json()
    if (r.ok) { setV(d.visit); setRxs(d.visit.prescriptions||[]) }
  }
  useEffect(() => { if (id) load() }, [id])

  const save = async (markComplete=false) => {
    setSaving(true)
    const r = await fetch(`/api/visits/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...v, prescriptions: rxs, complete: markComplete }) })
    setSaving(false)
    if (r.ok) { toast.success(markComplete?'Visit completed':'Saved'); if (markComplete) router.push(`/patients/${v.patient_id}`) }
    else toast.error('Failed')
  }

  const addRx = () => setRxs(p => [...p, { id: 'tmp_'+Date.now(), medicine_name:'', dosage:'', frequency:'', duration:'', instructions:'' }])
  const updateRx = (i, k, val) => setRxs(p => p.map((r,j) => j===i?{...r,[k]:val}:r))
  const removeRx = i => setRxs(p => p.filter((_,j)=>j!==i))

  if (!v) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={`/patients/${v.patient_id}`} className="text-sm text-muted-foreground hover:text-[#0D9488] flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4"/>Back to Patient</Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Visit — {v.patient_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{new Date(v.visit_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>save(false)} disabled={saving}>{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<><Save className="w-4 h-4 mr-2"/>Save</>}</Button>
          <Button onClick={()=>save(true)} disabled={saving} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Check className="w-4 h-4 mr-2"/>Complete Visit</Button>
        </div>
      </div>
      <Card className="mt-5 p-6 bg-white border-border rounded-lg space-y-4">
        <div className="space-y-1.5"><Label>Chief Complaint</Label><Textarea rows={2} value={v.chief_complaint||''} onChange={e=>set('chief_complaint',e.target.value)}/></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Diagnosis</Label><Textarea rows={3} value={v.diagnosis||''} onChange={e=>set('diagnosis',e.target.value)}/></div>
          <div className="space-y-1.5"><Label>Treatment Done</Label><Textarea rows={3} value={v.treatment_done||''} onChange={e=>set('treatment_done',e.target.value)}/></div>
        </div>
        <div className="space-y-1.5"><Label>Clinical Notes</Label><Textarea rows={4} value={v.clinical_notes||''} onChange={e=>set('clinical_notes',e.target.value)} placeholder="Examination findings, observations…"/></div>
        <div className="space-y-1.5"><Label>Treatment Plan</Label><Textarea rows={3} value={v.treatment_plan||''} onChange={e=>set('treatment_plan',e.target.value)} placeholder="Steps planned for upcoming visits…"/></div>
        <div className="flex items-center gap-3 py-2">
          <Switch checked={!!v.next_visit_recommended} onCheckedChange={val=>set('next_visit_recommended',val)} />
          <Label className="!mt-0">Recommend follow-up visit</Label>
          {v.next_visit_recommended && <Input type="date" value={v.next_visit_date||''} onChange={e=>set('next_visit_date', e.target.value)} className="w-44 ml-2"/>}
        </div>
      </Card>
      <Card className="mt-5 p-6 bg-white border-border rounded-lg">
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Prescriptions</h3><Button size="sm" variant="outline" onClick={addRx}><Plus className="w-4 h-4 mr-1"/>Add</Button></div>
        {rxs.length===0 && <div className="text-sm text-muted-foreground py-4">No prescriptions added</div>}
        {rxs.map((r,i)=>(
          <div key={r.id} className="grid grid-cols-12 gap-2 mb-2">
            <Input className="col-span-3" placeholder="Medicine" value={r.medicine_name} onChange={e=>updateRx(i,'medicine_name',e.target.value)}/>
            <Input className="col-span-2" placeholder="Dosage" value={r.dosage} onChange={e=>updateRx(i,'dosage',e.target.value)}/>
            <Input className="col-span-2" placeholder="Frequency" value={r.frequency} onChange={e=>updateRx(i,'frequency',e.target.value)}/>
            <Input className="col-span-2" placeholder="Duration" value={r.duration} onChange={e=>updateRx(i,'duration',e.target.value)}/>
            <Input className="col-span-2" placeholder="Instructions" value={r.instructions} onChange={e=>updateRx(i,'instructions',e.target.value)}/>
            <button type="button" onClick={()=>removeRx(i)} className="col-span-1 hover:bg-red-50 rounded flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-500"/></button>
          </div>
        ))}
      </Card>
    </div>
  )
}
export default App
