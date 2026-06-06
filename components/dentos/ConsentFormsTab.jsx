'use client'
import { useEffect, useState } from 'react'
import { FileText, Send, Download, Copy, Eye, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : '—'

export function ConsentFormsTab({ patientId, patientName, patientPhone }) {
  const [consents, setConsents] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [sending, setSending] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [consentLink, setConsentLink] = useState('')
  const [copyButtonText, setCopyButtonText] = useState('Copy Link')

  const load = async () => {
    setLoading(true)
    const [cRes, tRes] = await Promise.all([
      fetch(`/api/consent-requests?patient_id=${patientId}`),
      fetch('/api/consent-templates')
    ])
    const cData = await cRes.json()
    const tData = await tRes.json()
    setConsents(cData.consent_requests || [])
    setTemplates(tData.templates?.filter(t => t.active) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [patientId])

  const sendConsent = async () => {
    if (!selectedTemplate) { toast.error('Please select a template'); return }
    setSending(true)
    const r = await fetch('/api/consent-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, template_id: selectedTemplate })
    })
    const d = await r.json()
    setSending(false)
    if (r.ok) {
      setConsentLink(d.consent_link)
      setOpen(false)
      setSelectedTemplate('')
      setLinkDialogOpen(true)
      load()
    } else {
      toast.error(d.error || 'Failed to send consent')
    }
  }

  const copyLink = async (link) => {
    await navigator.clipboard.writeText(link)
    setCopyButtonText('Copied!')
    setTimeout(() => setCopyButtonText('Copy Link'), 2000)
  }

  const viewPdf = async (id) => {
    window.open(`/api/consent-requests/pdf?id=${id}`, '_blank')
  }

  const downloadPdf = async (id) => {
    window.open(`/api/consent-requests/pdf?id=${id}`, '_blank')
  }

  const getStatusBadge = (status, sentAt) => {
    if (status === 'Signed') {
      return <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Signed</span>
    }
    if (status === 'Pending') {
      const hoursSinceSent = (new Date() - new Date(sentAt)) / (1000 * 60 * 60)
      const isOverdue = hoursSinceSent > 24
      return (
        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${isOverdue ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
          <Clock className="w-3 h-3"/>Pending {isOverdue && <AlertCircle className="w-3 h-3"/>}
        </span>
      )
    }
    return <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{status}</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Consent Forms</h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Send className="w-4 h-4 mr-1"/>Request Consent</Button>
      </div>

      {loading && (
        <div className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0D9488]"/>
        </div>
      )}

      {!loading && consents.length === 0 && (
        <Card className="p-12 text-center bg-white border-border rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40"/>
          <p className="mt-3 text-muted-foreground text-sm">No consent forms requested yet. Send a consent request to get started.</p>
        </Card>
      )}

      {!loading && consents.length > 0 && (
        <div className="space-y-3">
          {consents.map(c => (
            <Card key={c.id} className="p-4 bg-white border-border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{c.template_name}</div>
                    {getStatusBadge(c.status, c.sent_at)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Sent: {fmtDate(c.sent_at)} · {c.status === 'Signed' ? `Signed: ${fmtDate(c.signed_at)}` : 'Awaiting signature'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.status === 'Pending' && c.consent_link && (
                    <Button size="sm" variant="outline" onClick={() => copyLink(c.consent_link)} className="h-8">
                      <Copy className="w-3.5 h-3.5 mr-1"/>Copy Link
                    </Button>
                  )}
                  {c.status === 'Signed' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => viewPdf(c.id)} className="h-8">
                        <Eye className="w-3.5 h-3.5 mr-1"/>View
                      </Button>
                      <Button size="sm" onClick={() => downloadPdf(c.id)} className="h-8 bg-[#0D9488] hover:bg-[#0B7E73]">
                        <Download className="w-3.5 h-3.5 mr-1"/>PDF
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Request Consent for {patientName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Select Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger><SelectValue placeholder="Choose a consent template"/></SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No active templates available</div>}
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} · {t.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={sendConsent} disabled={sending || !selectedTemplate} className="bg-[#0D9488] hover:bg-[#0B7E73]">
                {sending ? <><Loader2 className="w-4 h-4 animate-spin mr-1"/>Sending...</> : <><Send className="w-4 h-4 mr-1"/>Send Request</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Consent Request Created</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share this link with the patient via WhatsApp or SMS</p>
            <div className="space-y-1.5">
              <Input value={consentLink} readOnly className="font-mono text-sm"/>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => copyLink(consentLink)} variant="outline" className="w-full">
                <Copy className="w-4 h-4 mr-2"/>{copyButtonText}
              </Button>
              {patientPhone && (
                <Button
                  onClick={() => window.open(`https://wa.me/${patientPhone.replace(/\D/g, '')}?text=Please sign your consent form: ${encodeURIComponent(consentLink)}`, '_blank')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4 mr-2"/>WhatsApp
                </Button>
              )}
              <Button onClick={() => setLinkDialogOpen(false)} variant="outline" className="w-full">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
