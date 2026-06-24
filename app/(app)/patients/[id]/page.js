'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, RefreshCw } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Edit2, AlertTriangle, ChevronDown, ChevronUp, CalendarPlus, FilePlus, FileText, Upload, ExternalLink, Loader2, Send, Download, Copy, FlaskConical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'
import { DocumentsTab } from '@/components/dentos/DocumentsTab'
import { ConsentFormsTab } from '@/components/dentos/ConsentFormsTab'
import { NewLabCaseDialog } from '@/components/dentos/NewLabCaseDialog'
import { LAB_CASE_STATUS_META, statusLabel } from '@/lib/lab-case-helpers'
import BalanceBadge from '@/components/dentos/BalanceBadge'
import OutstandingBalanceModal from '@/components/dentos/OutstandingBalanceModal'
const labStatusBadge = (s) => {
  const cls = LAB_CASE_STATUS_META[s]?.badge || 'bg-slate-100 text-slate-700'
  return <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${cls}`}>{statusLabel(s)}</span>
}

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'
const todayIso = () => new Date().toISOString().slice(0,10)

function App() {
  const { id } = useParams()
  const router = useRouter()
  const { isReceptionist, canAccessClinical } = useRole()
  const receptionist = isReceptionist()
  const clinical = canAccessClinical()
  const [patient, setPatient] = useState(null)
  const [visits, setVisits] = useState([])
  const [appts, setAppts] = useState([])
  const [editOpen, setEditOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [expanded, setExpanded] = useState({})
const [labCases, setLabCases] = useState([])
  const [newLabOpen, setNewLabOpen] = useState(false)
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
const loadLabCases = async () => {
    const r = await fetch(`/api/lab-cases?patient_id=${id}`)
    if (r.ok) setLabCases((await r.json()).lab_cases || [])
  }

  const load = async () => {
    const [r, v, a] = await Promise.all([
      fetch(`/api/patients/${id}`),
      fetch(`/api/visits?patient_id=${id}`),
      fetch(`/api/appointments?patient_id=${id}`)
    ])
    if (r.ok) setPatient((await r.json()).patient)
    if (v.ok) setVisits((await v.json()).visits||[])
    if (a.ok) setAppts((await a.json()).appointments||[])
    loadLabCases()
  }
  useEffect(() => { if (id) load() }, [id])

  const startWalkin = async () => {
    const r = await fetch('/api/visits', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patient_id: id, chief_complaint: '' }) })
    const d = await r.json()
    if (r.ok) router.push(`/visits/${d.id}`)
    else toast.error(d.error||'Failed')
  }

  if (!patient) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  const upcoming = appts.filter(a => a.appointment_date >= todayIso())
  const past = appts.filter(a => a.appointment_date < todayIso())

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/patients" className="text-sm text-muted-foreground hover:text-[#0D9488] flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4"/>Back to Patients</Link>
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <div className="lg:col-span-3">
          <Card className="p-6 bg-white border-border rounded-lg sticky top-20">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#0F172A] truncate">{patient.name}</h1>
                  <BalanceBadge
                    patientId={id}
                    onClick={() => setBalanceModalOpen(true)}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{patient.patient_code}</div>
              </div>
              <button type="button" onClick={()=>setEditOpen(true)} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Edit patient"><Edit2 className="w-4 h-4 text-muted-foreground"/></button>
            </div>
            <a href={`tel:+91${patient.phone}`} className="mt-4 flex items-center gap-2 text-sm text-[#0D9488] hover:underline"><Phone className="w-3.5 h-3.5"/>+91 {patient.phone}</a>
            <div className="mt-3 flex items-center gap-3 text-sm">
              {patient.age && <span className="text-muted-foreground">{patient.age} yrs</span>}
              {patient.gender && <span className="text-muted-foreground capitalize">· {patient.gender}</span>}
              {patient.blood_group && <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs font-medium">{patient.blood_group}</span>}
            </div>
            <div className="mt-5">
              {patient.allergies ? (
                <div className="p-3 rounded-md bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2 text-[#EF4444] font-semibold text-sm"><AlertTriangle className="w-4 h-4"/>Allergies</div>
                  <div className="text-sm text-red-900 mt-1">{patient.allergies}</div>
                </div>
              ) : <div className="text-xs text-muted-foreground">No known allergies</div>}
            </div>
            {patient.medical_history && (
              <div className="mt-4">
                <button onClick={()=>setShowHistory(s=>!s)} className="text-sm font-medium text-[#0F172A] flex items-center gap-1">Medical History {showHistory?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>}</button>
                {showHistory && <div className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{patient.medical_history}</div>}
              </div>
            )}
            <dl className="mt-5 space-y-2 text-sm">
              {patient.address && <div><dt className="text-xs text-muted-foreground">Address</dt><dd>{patient.address}</dd></div>}
              {patient.referral_source && <div><dt className="text-xs text-muted-foreground">Referral</dt><dd>{patient.referral_source}</dd></div>}
              <div><dt className="text-xs text-muted-foreground">Member since</dt><dd>{fmtDate(patient.created_at)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Total visits</dt><dd className="font-semibold text-[#0F172A]">{patient.total_visits || visits.length}</dd></div>
            </dl>
            <div className="mt-6 space-y-2">
              <Button onClick={()=>setBookOpen(true)} className="w-full bg-[#0D9488] hover:bg-[#0B7E73]"><CalendarPlus className="w-4 h-4 mr-2"/>Book Appointment</Button>
              {!receptionist && <Button onClick={startWalkin} variant="outline" className="w-full"><FilePlus className="w-4 h-4 mr-2"/>New Walk-in Visit</Button>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Tabs defaultValue="visits">
            <TabsList className="bg-[#F8FAFC]">
              <TabsTrigger value="visits">Visit History</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="lab-cases">Lab Cases</TabsTrigger>
              <TabsTrigger value="consents">Consent Forms</TabsTrigger>
              {!receptionist && <TabsTrigger value="ai">AI Summary</TabsTrigger>}
            </TabsList>
            <TabsContent value="visits" className="mt-4">
              {visits.length===0 && (
                <Card className="p-12 text-center bg-white border-border rounded-lg">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/40"/>
                  <p className="mt-3 text-muted-foreground">No visits recorded yet</p>
                  {!receptionist && <Button onClick={startWalkin} className="mt-4 bg-[#0D9488] hover:bg-[#0B7E73]"><FilePlus className="w-4 h-4 mr-2"/>Record First Visit</Button>}
                </Card>
              )}
              {visits.length>0 && (
                <div className="relative pl-6">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-border"/>
                  {visits.map((v,i) => (
                    <div key={v.id} className="relative mb-4">
                      <div className={`absolute -left-5 top-3 w-3 h-3 rounded-full ${i===0?'bg-[#0D9488] ring-4 ring-[#0D9488]/20':'bg-border'}`}/>
                      <Card className="p-5 bg-white border-border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div><div className="font-semibold text-[#0F172A]">{fmtDate(v.visit_date)}</div><div className="text-xs text-muted-foreground">Dr. {v.doctor_name||'—'}</div></div>
                          {clinical ? (
                            <Link href={`/visits/${v.id}`}><Button size="sm" variant="outline" className="h-8"><ExternalLink className="w-3.5 h-3.5 mr-1"/>Open</Button></Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">Doctor only</span>
                          )}
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          {v.chief_complaint && <div><span className="text-xs text-muted-foreground">Chief Complaint</span><div>{v.chief_complaint}</div></div>}
                          {v.diagnosis && <div><span className="text-xs text-muted-foreground">Diagnosis</span><div>{v.diagnosis}</div></div>}
                          {v.treatment_done && <div><span className="text-xs text-muted-foreground">Treatment Done</span><div>{v.treatment_done}</div></div>}
                        </div>
                        <button onClick={()=>setExpanded(p=>({...p,[v.id]:!p[v.id]}))} className="mt-3 text-xs text-[#0D9488] flex items-center gap-1">
                          View Full Notes {expanded[v.id]?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
                        </button>
                        {expanded[v.id] && (
                          <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
                            {v.clinical_notes && <div><span className="text-xs text-muted-foreground">Clinical Notes</span><div className="whitespace-pre-line">{v.clinical_notes}</div></div>}
                            {v.treatment_plan && <div><span className="text-xs text-muted-foreground">Treatment Plan</span><div className="whitespace-pre-line">{v.treatment_plan}</div></div>}
                            {v.prescriptions?.length>0 && <div><span className="text-xs text-muted-foreground">Prescriptions</span>
                              <ul className="mt-1 space-y-1">{v.prescriptions.map(p => <li key={p.id} className="text-sm">• <span className="font-medium">{p.medicine_name}</span> {p.dosage} · {p.frequency} · {p.duration}</li>)}</ul>
                            </div>}
                          </div>
                        )}
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="appointments" className="mt-4 space-y-3">
              {upcoming.length===0 && past.length===0 && <Card className="p-8 text-center text-muted-foreground bg-white border-border rounded-lg">No appointments yet</Card>}
              {upcoming.length>0 && <>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Upcoming</h4>
                {upcoming.map(a => (
                  <Card key={a.id} className="p-4 bg-blue-50/50 border-blue-200 rounded-lg flex items-center justify-between">
                    <div><div className="font-medium">{fmtDate(a.appointment_date)} · {a.appointment_time}</div><div className="text-xs text-muted-foreground capitalize">{a.appointment_type?.replace('_',' ')} · Dr. {a.doctor_name||'—'}</div></div>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 capitalize">{a.status?.replace('_',' ')}</span>
                  </Card>
                ))}
              </>}
              {past.length>0 && <>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mt-4">Past</h4>
                {past.map(a => (
                  <Card key={a.id} className="p-4 bg-white border-border rounded-lg flex items-center justify-between">
                    <div><div className="font-medium">{fmtDate(a.appointment_date)} · {a.appointment_time}</div><div className="text-xs text-muted-foreground capitalize">{a.appointment_type?.replace('_',' ')} · Dr. {a.doctor_name||'—'}</div></div>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">{a.status?.replace('_',' ')}</span>
                  </Card>
                ))}
              </>}
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              {patient && <DocumentsTab patientId={id} />}
            </TabsContent>
            <TabsContent value="lab-cases" className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><FlaskConical className="w-4 h-4 text-[#0D9488]"/>Lab Cases</h4>
                <Button size="sm" onClick={()=>setNewLabOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>New Lab Case</Button>
              </div>
              {labCases.length === 0 ? (
                <Card className="p-10 text-center bg-white border-border rounded-lg">
                  <FlaskConical className="w-10 h-10 mx-auto text-muted-foreground/40"/>
                  <p className="mt-3 text-muted-foreground text-sm">No lab cases for this patient yet</p>
                  <Button size="sm" onClick={()=>setNewLabOpen(true)} className="mt-4 bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Create Lab Case</Button>
                </Card>
              ) : (
                <Card className="bg-white border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-muted-foreground tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-medium">Case #</th>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Vendor</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Expected</th>
                          <th className="px-4 py-3 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labCases.map(c => (
                          <tr key={c.id} className="border-t border-border hover:bg-[#F8FAFC]/50 cursor-pointer" onClick={()=>router.push(`/lab-cases/${c.id}`)}>
                            <td className="px-4 py-3 font-medium text-[#0F172A]">{c.case_number}</td>
                            <td className="px-4 py-3 text-muted-foreground">{c.case_type}</td>
                            <td className="px-4 py-3">{c.vendor_name}</td>
                            <td className="px-4 py-3">{labStatusBadge(c.status)}</td>
                            <td className="px-4 py-3">
                              {c.expected_delivery_date
                                ? <span className={c.overdue ? 'text-[#EF4444] font-medium flex items-center gap-1' : 'text-muted-foreground'}>{c.overdue && <AlertTriangle className="w-3.5 h-3.5"/>}{fmtDate(c.expected_delivery_date)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="consents" className="mt-4">
              {patient && <ConsentFormsTab patientId={id} patientName={patient.name} patientPhone={patient.phone} />}
            </TabsContent>
            {!receptionist && (
            <TabsContent value="ai" className="mt-4">
              <AISummaryPanel patient={patient} visits={visits} onUpdated={load}/>
            </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
      <EditPatientModal open={editOpen} setOpen={setEditOpen} patient={patient} onSaved={load} clinicalLocked={receptionist} />
      <BookForPatient open={bookOpen} setOpen={setBookOpen} patient={patient} onCreated={load} />
<NewLabCaseDialog open={newLabOpen} setOpen={setNewLabOpen} lockedPatient={patient} navigateOnCreate={false} onCreated={loadLabCases} />
<OutstandingBalanceModal open={balanceModalOpen} onOpenChange={setBalanceModalOpen} patientId={id} />
    </div>
  )
}

function EditPatientModal({ open, setOpen, patient, onSaved, clinicalLocked }) {
  const [f, setF] = useState(patient)
  useEffect(() => setF(patient), [patient])
  const [loading, setLoading] = useState(false)
  const submit = async e => {
    e.preventDefault(); setLoading(true)
    const body = { ...f }
    if (clinicalLocked) {
      delete body.allergies
      delete body.medical_history
    }
    const r = await fetch(`/api/patients/${patient.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    setLoading(false)
    if (r.ok) { toast.success('Saved'); setOpen(false); onSaved && onSaved() } else toast.error('Failed')
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
          <div className="space-y-1.5 col-span-2"><Label>Full Name</Label><Input value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value.replace(/\D/g,'').slice(0,10)})}/></div>
          <div className="space-y-1.5"><Label>Age</Label><Input type="number" value={f.age||''} onChange={e=>setF({...f,age:e.target.value?parseInt(e.target.value):null})}/></div>
          <div className="space-y-1.5"><Label>Gender</Label><Select value={f.gender||''} onValueChange={v=>setF({...f,gender:v})}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Blood Group</Label><Select value={f.blood_group||''} onValueChange={v=>setF({...f,blood_group:v})}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
          {!clinicalLocked && (
            <>
              <div className="space-y-1.5 col-span-2"><Label className="text-[#EF4444]">Allergies</Label><Textarea rows={2} value={f.allergies||''} onChange={e=>setF({...f,allergies:e.target.value})}/></div>
              <div className="space-y-1.5 col-span-2"><Label>Medical History</Label><Textarea rows={2} value={f.medical_history||''} onChange={e=>setF({...f,medical_history:e.target.value})}/></div>
            </>
          )}
          <div className="space-y-1.5 col-span-2"><Label>Address</Label><Textarea rows={2} value={f.address||''} onChange={e=>setF({...f,address:e.target.value})}/></div>
          <div className="space-y-1.5 col-span-2"><Label>Referral Source</Label><Input value={f.referral_source||''} onChange={e=>setF({...f,referral_source:e.target.value})} placeholder="e.g. Google, Friend referral"/></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Save Changes'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BookForPatient({ open, setOpen, patient, onCreated }) {
  const [f, setF] = useState({ appointment_date: todayIso(), appointment_time:'10:00 AM', appointment_type:'follow_up', chief_complaint:'' })
  const submit = async e => {
    e.preventDefault()
    const r = await fetch('/api/appointments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...f, patient_id: patient.id }) })
    if (r.ok) { toast.success('Booked'); setOpen(false); onCreated && onCreated() } else toast.error('Failed')
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Book for {patient.name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.appointment_date} onChange={e=>setF({...f,appointment_date:e.target.value})}/></div>
            <div className="space-y-1.5"><Label>Time</Label><Input value={f.appointment_time} onChange={e=>setF({...f,appointment_time:e.target.value})}/></div>
          </div>
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={f.appointment_type} onValueChange={v=>setF({...f,appointment_type:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['new_patient','follow_up','emergency','consultation','procedure'].map(t=><SelectItem key={t} value={t} className="capitalize">{t.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Chief Complaint</Label><Textarea rows={2} value={f.chief_complaint} onChange={e=>setF({...f,chief_complaint:e.target.value})}/></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" className="bg-[#0D9488] hover:bg-[#0B7E73]">Book</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
function AISummaryPanel({ patient, visits, onUpdated }) {
  const [summary, setSummary] = useState(patient?.ai_summary || '')
  const [genAt, setGenAt] = useState(patient?.ai_summary_generated_at || null)
  const [loading, setLoading] = useState(false)
  const lastVisitDate = visits[0]?.visit_date || null
  const isStale = !genAt || (lastVisitDate && new Date(genAt) < new Date(lastVisitDate))
  const fmt = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : ''

  const generate = async () => {
    setLoading(true)
    const r = await fetch('/api/generate-summary', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patient_id: patient.id }) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { setSummary(d.summary); setGenAt(d.generated_at); toast.success('Summary generated successfully'); onUpdated && onUpdated() }
    else toast.error(d.error || 'Could not generate summary. Please try again.')
  }

  if (visits.length === 0) {
    return (
      <Card className="p-10 text-center bg-[#F8FAFC] border-border rounded-lg">
        <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/50"/>
        <p className="mt-3 text-muted-foreground">Add at least one visit to generate an AI summary</p>
        <Button disabled className="mt-4 bg-[#0D9488] opacity-50 cursor-not-allowed">Generate Summary</Button>
      </Card>
    )
  }

  if (summary && !isStale) {
    return (
      <Card className="p-6 bg-blue-50/40 border-blue-200 rounded-lg">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#0D9488]"/><h3 className="font-semibold text-[#0F172A]">AI Clinical Summary</h3></div>
            <p className="text-xs text-muted-foreground mt-0.5">Generated {fmt(genAt)} · Documentation only</p>
          </div>
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>{loading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<><RefreshCw className="w-3.5 h-3.5 mr-1"/>Regenerate</>}</Button>
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-line text-[#0F172A]">{summary}</div>
        <p className="mt-4 pt-3 border-t border-blue-200 text-xs text-muted-foreground italic">This summary is generated from doctor&apos;s notes. It is a documentation tool only and does not constitute medical advice or diagnosis.</p>
      </Card>
    )
  }

  return (
    <Card className="p-10 text-center bg-white border-2 border-dashed border-border rounded-lg">
      <Sparkles className="w-10 h-10 mx-auto text-[#0D9488]"/>
      <h3 className="mt-3 font-semibold text-[#0F172A]">{summary ? 'New Visits Since Last Summary' : 'Generate AI Summary'}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">Automatically summarize this patient&apos;s treatment history from recorded visits. Documentation assistant only — does not diagnose.</p>
      <Button onClick={generate} disabled={loading} className="mt-5 bg-[#0D9488] hover:bg-[#0B7E73]">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Generating summary…</> : <><Sparkles className="w-4 h-4 mr-2"/>{summary?'Regenerate Summary':'Generate Summary'}</>}
      </Button>
    </Card>
  )
}

