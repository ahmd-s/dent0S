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
  const { visitId } = useParams()
  const [data, setData] = useState(null)
  const [notFound, setNotFound] = useState(false)

  const load = async () => {
    const r = await fetch(`/api/public/visit-summary/${visitId}`)
    if (r.status === 404) {
      setNotFound(true)
      return
    }
    if (r.ok) setData(await r.json())
  }
  useEffect(() => { if (visitId) load() }, [visitId])

  if (notFound) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">📄</div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Visit summary not found</h1>
        <p className="text-muted-foreground mt-2">This link may be invalid or expired.</p>
      </div>
    </div>
  )

  if (!data) return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#0D9488]"/></div>

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
              <ClinicLogo logoUrl={data.clinic?.logo_url} size="w-12 h-12" iconSize="w-6 h-6" />
              <div>
                <div className="text-xl font-bold text-[#0F172A]">{data.clinic?.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 max-w-xs">{data.clinic?.address}</div>
                <div className="text-xs text-muted-foreground">{data.clinic?.city}{data.clinic?.phone?` · ${data.clinic.phone}`:''}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Patient</div>
              <div className="font-semibold text-lg">{data.patient?.name}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Visit Details</div>
              <div className="font-semibold">{fmtDate(data.visit?.visit_date)}</div>
              <div className="text-sm text-muted-foreground mt-1">Doctor: {data.visit?.doctor_name}</div>
            </div>
          </div>

          {data.prescriptions && data.prescriptions.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">💊 Prescription</h3>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                  <tr><th className="text-left py-3 font-medium">Medicine</th><th className="text-left py-3 font-medium">Dosage</th><th className="text-left py-3 font-medium">Frequency</th><th className="text-left py-3 font-medium">Duration</th><th className="text-left py-3 font-medium">Instructions</th></tr>
                </thead>
                <tbody>
                  {data.prescriptions.map((rx, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-3">{rx.medicine_name}</td>
                      <td className="py-3">{rx.dosage}</td>
                      <td className="py-3">{rx.frequency}</td>
                      <td className="py-3">{rx.duration}</td>
                      <td className="py-3">{rx.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!data.prescriptions || data.prescriptions.length === 0 && (
            <div className="mt-8 text-sm text-muted-foreground">No prescriptions for this visit</div>
          )}

          {data.invoice && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">🧾 Invoice</h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-muted-foreground">Invoice Number</div>
                  <div className="font-mono font-medium">{data.invoice.invoice_number}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Date</div>
                  <div>{fmtDate(data.invoice.invoice_date)}</div>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                  <tr><th className="text-left py-3 font-medium">Description</th><th className="text-right py-3 font-medium w-16">Qty</th><th className="text-right py-3 font-medium w-24">Unit Price</th><th className="text-right py-3 font-medium w-28">Total</th></tr>
                </thead>
                <tbody>
                  {data.invoice.items?.map((it, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-3">{it.description}</td>
                      <td className="text-right py-3">{it.quantity}</td>
                      <td className="text-right py-3">{inr(it.unit_price)}</td>
                      <td className="text-right py-3">{inr(it.total)}</td>
                    </tr>
                  ))}
                  {(!data.invoice.items || data.invoice.items.length===0) && <tr><td colSpan="4" className="text-center py-6 text-muted-foreground">No line items</td></tr>}
                </tbody>
              </table>

              <div className="mt-6 ml-auto max-w-xs text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(data.invoice.subtotal)}</span></div>
                {data.invoice.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-600">- {inr(data.invoice.discount)}</span></div>}
                {data.invoice.gst_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>{inr(data.invoice.gst_amount)}</span></div>}
                <div className="flex justify-between pt-3 border-t-2 border-border text-lg font-bold"><span>TOTAL</span><span>{inr(data.invoice.total_amount)}</span></div>
              </div>

              <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
                <div className="text-sm"><span className="text-muted-foreground">Payment: </span><span className="capitalize font-medium">{data.invoice.payment_mode?.replace('_',' ')||'Not specified'}</span></div>
                {statusBadge(data.invoice.payment_status)}
              </div>
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            Thank you for visiting {data.clinic?.name}.
            <div className="text-xs mt-1">{data.clinic?.address} {data.clinic?.phone?` · ${data.clinic.phone}`:''}</div>
          </div>
        </Card>

        <div className="text-center text-xs text-muted-foreground mt-6 print:hidden">Powered by <span className="text-[#0D9488] font-medium">DentOS</span></div>
      </div>
      <style jsx global>{`@media print { aside, header, .print\\:hidden { display: none !important } body { background: white !important } }`}</style>
    </div>
  )
}
export default App
