'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Mail, User, Building2, Loader2, AlertTriangle, Trash2, Clock, Paperclip, Link2, Copy, Check, MessageCircle, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'
import { LabCaseAttachments } from '@/components/dentos/LabCaseAttachments'
import STLViewer from '@/components/STLViewer'
import { LAB_CASE_STATUS_META, statusLabel } from '@/lib/lab-case-helpers'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'
const fmtDateTime = d => {
  if (!d) return '—'
  const x = new Date(d)
  if (isNaN(x.getTime())) return '—'
  return `${fmtDate(d)} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`
}

// Curated clinic-facing status order (includes legacy values so any stored
// status still renders correctly in the dropdown).
const STATUS_OPTIONS = ['pending', 'sent', 'lab_received', 'in_production', 'ready', 'delivered', 'received', 'in_progress', 'completed', 'cancelled']

const statusBadge = (s) => {
  const cls = LAB_CASE_STATUS_META[s]?.badge || 'bg-slate-100 text-slate-700'
  return <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{statusLabel(s)}</span>
}
const waPhone = (p) => { const d = (p || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d }

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5 text-foreground">{value || '—'}</div>
    </div>
  )
}

function App() {
  const { id } = useParams()
  const router = useRouter()
  const { canManageInventory } = useRole()
  const canManage = canManageInventory()
  const [lc, setLc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusNote, setStatusNote] = useState('')
  const [audit, setAudit] = useState([])
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [stlLink, setStlLink] = useState(null)
  const [generatingLink, setGeneratingLink] = useState(false)

  const load = async () => {
    const r = await fetch(`/api/lab-cases/${id}`)
    if (r.ok) setLc((await r.json()).lab_case)
    else { toast.error('Lab case not found'); router.push('/lab-cases') }
  }
  const loadAudit = async () => {
    const r = await fetch(`/api/lab-cases/${id}/audit`)
    if (r.ok) setAudit((await r.json()).audit || [])
  }
  useEffect(() => { if (id) { load(); loadAudit() } }, [id])

  const portalLink = lc?.public_token && typeof window !== 'undefined' ? `${window.location.origin}/lab-portal/${lc.public_token}` : ''

  const changeStatus = async (status) => {
    setSaving(true)
    const r = await fetch(`/api/lab-cases/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, status_note: statusNote }) })
    const d = await r.json()
    setSaving(false)
    if (r.ok) { toast.success('Status updated'); setStatusNote(''); setLc(d.lab_case); loadAudit() }
    else toast.error(d.error || 'Failed to update status')
  }

  const del = async () => {
    if (!confirm('Delete this lab case permanently?')) return
    const r = await fetch(`/api/lab-cases/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Lab case deleted'); router.push('/lab-cases') }
    else toast.error('Failed to delete')
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(portalLink); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { toast.error('Could not copy link') }
  }

  const sendToLab = async () => {
    setSharing(true)
    try {
      const r = await fetch(`/api/lab-cases/${id}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'WhatsApp' }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Failed to share'); return }
      const link = `${window.location.origin}/lab-portal/${d.public_token}`
      const msg = `Hello ${lc.vendor_name}\n\nA new lab case has been assigned.\n\nCase ID: ${lc.case_number}\nPatient: ${lc.patient_name}\nCase Type: ${lc.case_type}\n\nOpen case:\n${link}\n\nPlease update status using this link.`
      window.open(`https://wa.me/${waPhone(lc.vendor_phone)}?text=${encodeURIComponent(msg)}`, '_blank')
      loadAudit()
    } finally { setSharing(false) }
  }

  const generateSTLLink = async () => {
    setGeneratingLink(true)
    try {
      const res = await fetch(`/api/lab-cases/${id}/generate-stl-link`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) setStlLink(data.upload_url)
      else alert(data.error || 'Failed to generate link')
    } catch (e) {
      alert('Failed to generate link')
    }
    setGeneratingLink(false)
  }

  if (!lc) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  const timeline = [...(lc.timeline || [])].sort((a,b) => new Date(b.at) - new Date(a.at))

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/lab-cases" className="text-sm text-muted-foreground hover:text-[#0D9488] flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4"/>Back to Lab Cases</Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{lc.case_number}</h1>
            {statusBadge(lc.status)}
            {lc.overdue && <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/>Overdue</span>}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{lc.case_type} · for <Link href={`/patients/${lc.patient_id}`} className="text-[#0D9488] hover:underline">{lc.patient_name}</Link></div>
        </div>
        {canManage && <Button variant="outline" onClick={del} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4 mr-1"/>Delete</Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* PROMINENT VENDOR CONTACT — primary value: call the lab fast */}
          <Card className="p-5 bg-card border-2 border-[#0D9488]/30 rounded-lg">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#0D9488] font-semibold mb-3"><Building2 className="w-4 h-4"/>Vendor Contact</div>
            <div className="text-lg font-bold text-foreground">{lc.vendor_name}</div>
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
            {lc.vendor_phone ? (
              <Button onClick={sendToLab} disabled={sharing} variant="outline" className="w-full mt-2 border-green-600 text-green-700 hover:bg-green-50">
                {sharing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <MessageCircle className="w-4 h-4 mr-2"/>}Send To Lab
              </Button>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground text-center">Add a vendor phone number to send via WhatsApp</p>
            )}
            <Link href="/vendors" className="mt-2 block text-center text-xs text-muted-foreground hover:text-[#0D9488]">View all vendors</Link>
          </Card>

          {/* SECURE LAB PORTAL LINK */}
          <Card className="p-5 bg-card border-border rounded-lg">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3"><Link2 className="w-4 h-4"/>Secure Lab Link</div>
            <p className="text-xs text-muted-foreground mb-2">Share this link so the lab can view the case and update status — no login required. Only this one case is exposed.</p>
            <div className="flex items-center gap-2">
              <input readOnly value={portalLink} className="flex-1 min-w-0 text-xs bg-muted/40 border border-input rounded-md px-2.5 py-2 text-muted-foreground" onFocus={e=>e.target.select()}/>
              <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={copyLink}>{copied ? <Check className="w-3.5 h-3.5 text-green-600"/> : <Copy className="w-3.5 h-3.5"/>}</Button>
            </div>
            {portalLink && <a href={portalLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-[#0D9488] hover:underline">Open portal preview ↗</a>}
          </Card>

          {/* STATUS WORKFLOW */}
          <Card className="p-5 bg-card border-border rounded-lg">
            <h3 className="font-semibold text-foreground mb-3">Update Status</h3>
            <div className="space-y-3">
              <Select value={lc.status} onValueChange={changeStatus} disabled={saving}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s=><SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea rows={2} value={statusNote} onChange={e=>setStatusNote(e.target.value)} placeholder="Optional note for the next status change…"/>
              {saving && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/>Saving…</div>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* CASE DETAILS */}
          <Card className="p-6 bg-card border-border rounded-lg">
            <h3 className="font-semibold text-foreground mb-4">Case Details</h3>
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
                <div className="text-sm mt-1 whitespace-pre-wrap text-foreground">{lc.description}</div>
              </div>
            )}
          </Card>

          <Card className="mt-4 p-4 bg-white border-border rounded-lg">
            <h3 className="font-semibold text-sm mb-3">3D Scan File</h3>
            {lc?.stl_file_url ? (
              <STLViewer url={lc.stl_file_url} height="400px" />
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                No 3D scan uploaded yet.
              </div>
            )}
            <div className="mt-4 flex items-center gap-3">
              {!stlLink ? (
                <Button size="sm" onClick={generateSTLLink} disabled={generatingLink}>
                  {generatingLink ? 'Generating...' : 'Generate Lab Upload Link'}
                </Button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <Input value={stlLink} readOnly className="text-xs h-8 flex-1" />
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(stlLink)}>Copy</Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Please upload the 3D scan file for your lab case here: ' + stlLink)}`, '_blank')}
                  >
                    Send via WhatsApp
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* ATTACHMENTS */}
          <Card className="p-6 bg-card border-border rounded-lg">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Paperclip className="w-4 h-4"/>Attachments</h3>
            <LabCaseAttachments caseId={id} attachments={lc.attachments || []} onChange={load} />
          </Card>

          {/* TIMELINE */}
          <Card className="p-6 bg-card border-border rounded-lg">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Clock className="w-4 h-4"/>Timeline</h3>
            {timeline.length === 0 && <div className="text-sm text-muted-foreground">No activity yet</div>}
            <div className="space-y-4">
              {timeline.map((t, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0D9488] mt-1.5"/>
                    {i < timeline.length-1 && <div className="w-px flex-1 bg-border my-1"/>}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2 flex-wrap">{statusBadge(t.status)}<span className="text-xs text-muted-foreground">{fmtDateTime(t.at)}</span>{t.source && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.source==='Lab Portal'?'bg-purple-50 text-purple-700':'bg-slate-100 text-slate-600'}`}>{t.source}</span>}</div>
                    {t.note && <div className="text-sm mt-1 text-foreground">{t.note}</div>}
                    {t.by_name && <div className="text-xs text-muted-foreground mt-0.5">by {t.by_name}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* AUDIT LOG */}
          <Card className="p-6 bg-card border-border rounded-lg">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><ScrollText className="w-4 h-4"/>Audit Log</h3>
            {audit.length === 0 && <div className="text-sm text-muted-foreground">No audit entries yet</div>}
            {audit.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground tracking-wider border-b border-border">
                    <tr><th className="py-2 pr-4 font-medium">When</th><th className="py-2 pr-4 font-medium">Action</th><th className="py-2 pr-4 font-medium">By</th><th className="py-2 font-medium">Source</th></tr>
                  </thead>
                  <tbody>
                    {audit.map(a => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{fmtDateTime(a.at)}</td>
                        <td className="py-2 pr-4 text-foreground">{a.action}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{a.actor_name || '—'}</td>
                        <td className="py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.source==='Lab Portal'?'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300':a.source==='System'?'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{a.source}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App
