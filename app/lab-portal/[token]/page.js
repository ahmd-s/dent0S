'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Clock, Paperclip, CheckCircle2, FlaskConical, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { LabCaseAttachments } from '@/components/dentos/LabCaseAttachments'
import { LAB_CASE_STATUS_META, LAB_PORTAL_STATUS_FLOW, statusLabel } from '@/lib/lab-case-helpers'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'
const fmtDateTime = d => {
  if (!d) return '—'
  const x = new Date(d)
  if (isNaN(x.getTime())) return '—'
  return `${fmtDate(d)} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`
}
const statusBadge = (s) => {
  const cls = LAB_CASE_STATUS_META[s]?.badge || 'bg-slate-100 text-slate-700'
  return <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{statusLabel(s)}</span>
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5 text-foreground">{value || '—'}</div>
    </div>
  )
}

export default function LabPortalPage() {
  const { token } = useParams()
  const [lc, setLc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState('')
  const [note, setNote] = useState('')

  const load = async () => {
    try {
      const r = await fetch(`/api/lab-portal/${token}`)
      if (!r.ok) { setError(r.status === 404 ? 'This link is invalid or has expired.' : 'Unable to load this case.'); return }
      setLc((await r.json()).lab_case)
    } catch { setError('Unable to load this case.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (token) load() }, [token])

  const updateStatus = async (status) => {
    setUpdating(status)
    try {
      const r = await fetch(`/api/lab-portal/${token}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note }) })
      const d = await r.json()
      if (r.ok) { toast.success('Status updated — the clinic will see this in DentOS'); setLc(d.lab_case); setNote('') }
      else toast.error(d.error || 'Could not update status')
    } catch { toast.error('Could not update status') }
    finally { setUpdating('') }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-7 h-7 animate-spin text-[#0D9488]"/></div>
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="p-8 text-center max-w-md w-full">
        <AlertCircle className="w-10 h-10 mx-auto text-red-400"/>
        <h1 className="mt-3 text-lg font-semibold text-foreground">Case unavailable</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </Card>
    </div>
  )

  const timeline = [...(lc.timeline || [])].sort((a,b) => new Date(b.at) - new Date(a.at))

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center"><FlaskConical className="w-4.5 h-4.5 text-white"/></div>
          <div>
            <div className="font-semibold text-foreground leading-tight">Lab Portal</div>
            <div className="text-xs text-muted-foreground leading-tight">Secure single-case view</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{lc.case_number}</h1>
            <div className="text-sm text-muted-foreground mt-0.5">{lc.case_type}{lc.lab_name ? ` · ${lc.lab_name}` : ''}</div>
          </div>
          <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Current status</span>{statusBadge(lc.status)}</div>
        </div>

        {/* STATUS UPDATE */}
        <Card className="p-5 bg-card">
          <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0D9488]"/>Update Status</h3>
          <p className="text-xs text-muted-foreground mb-4">Tap a status as the case progresses. The clinic is updated automatically.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LAB_PORTAL_STATUS_FLOW.map(s => {
              const active = lc.status === s.value
              return (
                <Button key={s.value} variant={active ? 'default' : 'outline'} disabled={!!updating}
                  onClick={() => updateStatus(s.value)}
                  className={active ? 'bg-[#0D9488] hover:bg-[#0B7E73]' : ''}>
                  {updating === s.value ? <Loader2 className="w-4 h-4 animate-spin"/> : s.label}
                </Button>
              )
            })}
          </div>
          <Textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note for the clinic…" className="mt-3"/>
        </Card>

        {/* CASE INFO */}
        <Card className="p-5 bg-card">
          <h3 className="font-semibold text-foreground mb-4">Case Information</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Patient" value={lc.patient_name}/>
            <Field label="Case Type" value={lc.case_type}/>
            <Field label="Urgency" value={lc.urgency}/>
            <Field label="Tooth Numbers" value={lc.tooth_numbers}/>
            <Field label="Shade" value={lc.shade}/>
            <Field label="Material" value={lc.material}/>
            <Field label="Expected Delivery" value={lc.expected_delivery_date ? fmtDate(lc.expected_delivery_date) : null}/>
          </div>
          {lc.notes && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
              <div className="text-sm mt-1 whitespace-pre-wrap text-foreground">{lc.notes}</div>
            </div>
          )}
        </Card>

        {/* ATTACHMENTS */}
        <Card className="p-5 bg-card">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Paperclip className="w-4 h-4"/>Attachments</h3>
          <LabCaseAttachments attachments={lc.attachments || []} readOnly />
        </Card>

        {/* TIMELINE */}
        <Card className="p-5 bg-card">
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
                  <div className="flex items-center gap-2 flex-wrap">{statusBadge(t.status)}<span className="text-xs text-muted-foreground">{fmtDateTime(t.at)}</span>{t.source && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.source==='Lab Portal'?'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300':'bg-muted text-muted-foreground'}`}>{t.source}</span>}</div>
                  {t.note && <div className="text-sm mt-1 text-foreground">{t.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-6">Powered by DentOS · This secure link only shows this single case.</p>
      </main>
    </div>
  )
}
