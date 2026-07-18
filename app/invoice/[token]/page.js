'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer, Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ClinicLogo } from '@/components/dentos/Logo'

const inr = n => '₹' + (n||0).toLocaleString('en-IN')
const fmtDate = d => d ? `${String(new Date(d+'T00:00:00').getDate()).padStart(2,'0')}/${String(new Date(d+'T00:00:00').getMonth()+1).padStart(2,'0')}/${new Date(d+'T00:00:00').getFullYear()}` : '—'
const statusBadge = s => {
  const m = { pending:'bg-orange-100 text-orange-700', paid:'bg-green-100 text-green-700', partial:'bg-yellow-100 text-yellow-700', waived:'bg-slate-200 text-slate-600' }
  return <span className={`text-xs px-3 py-1 rounded-full capitalize font-medium ${m[s]||'bg-slate-100'}`}>{s}</span>
}

function App() {
  const { token } = useParams()
  const [inv, setInv] = useState(null)
  const [notFound, setNotFound] = useState(false)

  const load = async () => {
    const r = await fetch(`/api/public/invoice/${token}`)
    if (r.status === 404) {
      setNotFound(true)
      return
    }
    if (r.ok) setInv((await r.json()).invoice)
  }
  useEffect(() => { if (token) load() }, [token])

  if (notFound) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">📄</div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Invoice not found</h1>
        <p className="text-muted-foreground mt-2">This invoice link may be invalid or expired.</p>
      </div>
    </div>
  )

  if (!inv) return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#0D9488]"/></div>

  const handlePrint = () => window.print()
  const handleDownload = () => window.print()

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-end gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2"/>Print</Button>
          <Button variant="outline" onClick={handleDownload}><Download className="w-4 h-4 mr-2"/>Download PDF</Button>
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

        <div className="text-center text-xs text-muted-foreground mt-6 print:hidden">Powered by <span className="text-[#0D9488] font-medium">DentOS</span></div>
      </div>
      <style jsx global>{`@media print { aside, header, .print\\:hidden { display: none !important } body { background: white !important } }`}</style>
    </div>
  )
}
export default App
