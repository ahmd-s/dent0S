'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer, MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ClinicLogo } from '@/components/dentos/Logo'
import { toast } from 'sonner'

const inr = n => '₹' + (n||0).toLocaleString('en-IN')
const fmtDate = d => d ? `${String(new Date(d+'T00:00:00').getDate()).padStart(2,'0')}/${String(new Date(d+'T00:00:00').getMonth()+1).padStart(2,'0')}/${new Date(d+'T00:00:00').getFullYear()}` : '—'
const statusBadge = s => {
  const m = { pending:'bg-orange-100 text-orange-700', paid:'bg-green-100 text-green-700', partial:'bg-yellow-100 text-yellow-700', waived:'bg-slate-200 text-slate-600' }
  return <span className={`text-xs px-3 py-1 rounded-full capitalize font-medium ${m[s]||'bg-slate-100'}`}>{s}</span>
}

function App() {
  const { id } = useParams()
  const router = useRouter()
  const [inv, setInv] = useState(null)
  const [payOpen, setPayOpen] = useState(false)

  const load = async () => {
    const r = await fetch(`/api/invoices/${id}`)
    if (r.ok) {
      const data = await r.json()
      setInv(data.invoice)
      // Auto-generate share_token if missing
      if (!data.invoice.share_token) {
        await fetch(`/api/invoices/${id}`, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ generate_share_token: true })
        })
        // Reload to get the share_token
        const r2 = await fetch(`/api/invoices/${id}`)
        if (r2.ok) setInv((await r2.json()).invoice)
      }
    }
  }
  useEffect(() => { if (id) load() }, [id])

  if (!inv) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  const wa = () => {
    const phone = inv.patient?.phone
    if (!phone) { toast.error('No phone number'); return }
    if (!inv.share_token) { toast.error('Share token not generated'); return }
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
    const publicUrl = `${baseUrl}/invoice/${inv.share_token}`
    const text = `Hello ${inv.patient?.name},\n\nYour invoice from ${inv.clinic?.name} is ready.\n\nInvoice No: ${inv.invoice_number}\nDate: ${fmtDate(inv.invoice_date)}\nAmount: ${inr(inv.total_amount)}\nStatus: ${inv.payment_status}\n\nView your invoice here:\n${publicUrl}\n\nThank you for visiting us!\n${inv.clinic?.phone ? '+91 ' + inv.clinic.phone : ''}`
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href="/billing" className="text-sm text-muted-foreground hover:text-[#0D9488] flex items-center gap-1"><ArrowLeft className="w-4 h-4"/>Back to Billing</Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>window.print()}><Printer className="w-4 h-4 mr-2"/>Print</Button>
          <Button variant="outline" onClick={wa} className="text-green-700 border-green-300 hover:bg-green-50"><MessageCircle className="w-4 h-4 mr-2"/>WhatsApp</Button>
          {(inv.payment_status==='pending' || inv.payment_status==='partial') && <Button onClick={()=>setPayOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73]">Mark Paid</Button>}
        </div>
      </div>

      <Card className="p-10 bg-white border-border rounded-lg print:shadow-none print:border-0">
        <div className="flex items-start justify-between border-b-2 border-[#0D9488] pb-6">
          <div className="flex items-start gap-3">
            <ClinicLogo logoUrl={inv.clinic?.logo_url} size="w-12 h-12" iconSize="w-6 h-6" />
            <div>
              <div className="text-xl font-bold text-[#0F172A]">{inv.clinic?.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 max-w-xs">{inv.clinic?.address}</div>
              <div className="text-xs text-muted-foreground">{inv.clinic?.city}{inv.clinic?.phone?` · ${inv.clinic.phone}`:''}</div>
              {inv.clinic?.gstin && <div className="text-xs text-muted-foreground">GSTIN: {inv.clinic.gstin}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-wider text-[#0F172A]">INVOICE</div>
            <div className="font-mono text-sm text-muted-foreground mt-1">{inv.invoice_number}</div>
            <div className="text-sm text-muted-foreground">{fmtDate(inv.invoice_date)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Bill To</div>
            <div className="font-semibold text-lg">{inv.patient?.name}</div>
            {inv.patient?.phone && <div className="text-sm text-muted-foreground">+91 {inv.patient.phone}</div>}
            {inv.patient?.address && <div className="text-sm text-muted-foreground">{inv.patient.address}</div>}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Attending Doctor</div>
            <div className="font-semibold">{inv.doctor_name ? (inv.doctor_name.toLowerCase().startsWith('dr.') ? inv.doctor_name : `Dr. ${inv.doctor_name}`) : '—'}</div>
            {inv.visit?.diagnosis && <div className="text-sm text-muted-foreground mt-1">Dx: {inv.visit.diagnosis}</div>}
          </div>
        </div>

        <table className="w-full mt-8 text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b-2 border-border">
            <tr><th className="text-left py-3 font-medium">Description</th><th className="text-right py-3 font-medium w-16">Qty</th><th className="text-right py-3 font-medium w-24">Unit</th><th className="text-right py-3 font-medium w-28">Total</th></tr>
          </thead>
          <tbody>
            {inv.items?.map(it => (
              <tr key={it.id} className="border-b border-border">
                <td className="py-3">{it.description}</td>
                <td className="text-right py-3">{it.quantity}</td>
                <td className="text-right py-3">{inr(it.unit_price)}</td>
                <td className="text-right py-3">{inr(it.total)}</td>
              </tr>
            ))}
            {(!inv.items || inv.items.length===0) && <tr><td colSpan="4" className="text-center py-6 text-muted-foreground">No line items</td></tr>}
          </tbody>
        </table>

        <div className="mt-6 ml-auto max-w-xs text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-600">- {inr(inv.discount)}</span></div>}
          {inv.gst_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>{inr(inv.gst_amount)}</span></div>}
          <div className="flex justify-between pt-3 border-t-2 border-border text-lg font-bold"><span>TOTAL</span><span>{inr(inv.total_amount)}</span></div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
          <div className="text-sm"><span className="text-muted-foreground">Payment: </span><span className="capitalize font-medium">{inv.payment_mode?.replace('_',' ')||'Not specified'}</span></div>
          {statusBadge(inv.payment_status)}
        </div>

        <div className="mt-10 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          Thank you for visiting {inv.clinic?.name}.
          <div className="text-xs mt-1">{inv.clinic?.address} {inv.clinic?.phone?` · ${inv.clinic.phone}`:''}</div>
        </div>
      </Card>

      <MarkPaidDialog open={payOpen} onClose={()=>setPayOpen(false)} invoice={inv} onSaved={load}/>
      <style jsx global>{`@media print { aside, header, .print\\:hidden { display: none !important } main { padding: 0 !important; background: white !important } }`}</style>
    </div>
  )
}

function MarkPaidDialog({ open, onClose, invoice, onSaved }) {
  const [mode, setMode] = useState('cash')
  const submit = async () => {
    const r = await fetch(`/api/invoices/${invoice.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ payment_status:'paid', payment_mode: mode }) })
    if (r.ok) { toast.success('Marked paid'); onClose(); onSaved && onSaved() } else toast.error('Failed')
  }
  return (
    <Dialog open={open} onOpenChange={v=>{if(!v) onClose()}}>
      <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Mark Paid</DialogTitle></DialogHeader>
        <div className="space-y-3"><div className="text-2xl font-bold">{inr(invoice?.total_amount)}</div>
          <div className="space-y-1.5"><Label>Payment Mode</Label><Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['cash','upi','card','net_banking'].map(p=><SelectItem key={p} value={p} className="capitalize">{p.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
          <Button onClick={submit} className="w-full bg-[#0D9488] hover:bg-[#0B7E73]">Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default App
