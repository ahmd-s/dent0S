'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Mail, User, Building2, Loader2, AlertTriangle, Trash2, Clock, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'
const fmtDateTime = d => {
  if (!d) return '—'
  const x = new Date(d)
  if (isNaN(x.getTime())) return '—'
  return `${fmtDate(d)} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`
}

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent to Lab' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'received', label: 'Received' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
const statusBadge = (s) => {
  const map = {
    pending: 'bg-slate-100 text-slate-700', sent: 'bg-blue-50 text-blue-700',
    in_progress: 'bg-orange-50 text-orange-700', received: 'bg-teal-50 text-teal-700',
    completed: 'bg-green-50 text-green-700', cancelled: 'bg-red-50 text-red-600',
  }
  return <span className={`text-xs px-2.5 py-1 rounded-full capitalize whitespace-nowrap ${map[s]||'bg-slate-100'}`}>{(s||'').replace('_',' ')}</span>
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5 text-[#0F172A]">{value || '—'}</div>
    </div>
  )
}

function App() {
  const { id } = useParams()
  const router = useRouter()
  const { isReceptionist } = useRole()
  const receptionist = isReceptionist()
  const [lc, setLc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusNote, setStatusNote] = useState('')

  const load = async () => {
    const r = await fetch(`/api/lab-cases/${id}`)
    if (r.ok) setLc((await r.json()).lab_case)
    else { toast.error('Lab case not found'); router.push('/lab-cases') }
  }
  useEffect(() => { if (id) load() }, [id])

  const changeStatus = async (status) => {
    setSaving(true)
    const r = await fetch(`/api/lab-cases/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, status_note: statusNote }) })
    const d = await r.json()
    setSaving(false)
    if (r.ok) { toast.success('Status updated'); setStatusNote(''); setLc(d.lab_case) }
    else toast.error(d.error || 'Failed to update status')
  }

  const del = async () => {
    if (!confirm('Delete this lab case permanently?')) return
    const r = await fetch(`/api/lab-cases/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Lab case deleted'); router.push('/lab-cases') }
    else toast.error('Failed to delete')
  }

  if (!lc) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  const timeline = [...(lc.timeline || [])].sort((a,b) => new Date(b.at) - new Date(a.at))

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/lab-cases" className="text-sm text-muted-foreground hover:text-[#0D9488] flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4"/>Back to Lab Cases</Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A]">{lc.case_number}</h1>
            {statusBadge(lc.status)}
            {lc.overdue && <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/>Overdue</span>}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{lc.case_type} · for <Link href={`/patients/${lc.patient_id}`} className="text-[#0D9488] hover:underline">{lc.patient_name}</Link></div>
        </div>
        {!receptionist && <Button variant="outline" onClick={del} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4 mr-1"/>Delete</Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* PROMINENT VENDOR CONTACT — primary value: call the lab fast */}
          <Card className="p-5 bg-white border-2 border-[#0D9488]/30 rounded-lg">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#0D9488] font-semibold mb-3"><Building2 className="w-4 h-4"/>Vendor Contact</div>
            <div className="text-lg font-bold text-[#0F172A]">{lc.vendor_name}</div>
            {lc.vendor_contact_person && <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2"><User className="w-4 h-4"/>Contact: {lc.vendor_contact_person}</div>}
            {lc.vendor_phone ? (
              <a href={`tel:${lc.vendor_phone}`} className="mt-3 flex items-center gap-2 text-base font-semibold text-[#0D9488] hover:underline">
                <Phone className="w-4 h-4"/>{lc.vendor_phone}
              </a>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-4 h-4"/>No phone on file</div>
            )}
            {lc.vendor_email && <a href={`mailto:${lc.vendor_email}`} className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground hover:underline"><Mail className="w-4 h-4"/>{lc.vendor_email}</a>}
            {lc.vendor_phone && (
              <a href={`tel:${lc.vendor_phone}`} className="mt-4 block">
                <Button className="w-full bg-[#0D9488] hover:bg-[#0B7E73]"><Phone className="w-4 h-4 mr-2"/>Call Lab</Button>
              </a>
            )}
            <Link href="/vendors" className="mt-2 block text-center text-xs text-muted-foreground hover:text-[#0D9488]">View all vendors</Link>
          </Card>

          {/* STATUS WORKFLOW */}
          <Card className="p-5 bg-white border-border rounded-lg">
            <h3 className="font-semibold text-[#0F172A] mb-3">Update Status</h3>
            <div className="space-y-3">
              <Select value={lc.status} onValueChange={changeStatus} disabled={saving}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{STATUSES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea rows={2} value={statusNote} onChange={e=>setStatusNote(e.target.value)} placeholder="Optional note for the next status change…"/>
              {saving && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/>Saving…</div>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* CASE DETAILS */}
          <Card className="p-6 bg-white border-border rounded-lg">
            <h3 className="font-semibold text-[#0F172A] mb-4">Case Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Patient" value={lc.patient_name}/>
              <Field label="Case Type" value={lc.case_type}/>
              <Field label="Urgency" value={lc.urgency}/>
              <Field label="Tooth Numbers" value={lc.tooth_numbers}/>
              <Field label="Shade" value={lc.shade}/>
              <Field label="Material" value={lc.material}/>
              <Field label="Expected Delivery" value={lc.expected_delivery_date ? fmtDate(lc.expected_delivery_date) : null}/>
              <Field label="Created" value={fmtDate(lc.created_at)}/>
            </div>
            {lc.description && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Description / Instructions</div>
                <div className="text-sm mt-1 whitespace-pre-wrap text-[#0F172A]">{lc.description}</div>
              </div>
            )}
          </Card>

          {/* TIMELINE */}
          <Card className="p-6 bg-white border-border rounded-lg">
            <h3 className="font-semibold text-[#0F172A] mb-4 flex items-center gap-2"><Clock className="w-4 h-4"/>Timeline</h3>
            {timeline.length === 0 && <div className="text-sm text-muted-foreground">No activity yet</div>}
            <div className="space-y-4">
              {timeline.map((t, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0D9488] mt-1.5"/>
                    {i < timeline.length-1 && <div className="w-px flex-1 bg-border my-1"/>}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2">{statusBadge(t.status)}<span className="text-xs text-muted-foreground">{fmtDateTime(t.at)}</span></div>
                    {t.note && <div className="text-sm mt-1 text-[#0F172A]">{t.note}</div>}
                    {t.by_name && <div className="text-xs text-muted-foreground mt-0.5">by {t.by_name}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App
