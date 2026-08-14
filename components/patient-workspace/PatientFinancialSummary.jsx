'use client'

import { useEffect, useState } from 'react'
import { IndianRupee, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PatientSectionGate } from '@/components/workspace/WorkspaceGate'
import { fmtPatientDate } from '@/lib/patient-clinical'

const inr = n => '₹' + (n || 0).toLocaleString('en-IN')

export default function PatientFinancialSummary({ patientId, readonly = false, onCollectPayment }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    fetch(`/api/patients/${patientId}/financial`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [patientId])

  const content = loading ? (
    <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  ) : (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Outstanding" value={inr(data?.summary?.outstanding)} alert={data?.summary?.outstanding > 0} />
        <MetricCard label="Paid" value={inr(data?.summary?.paid)} />
        <MetricCard label="Total Billed" value={inr(data?.summary?.total)} />
        <MetricCard label="Invoices" value={data?.summary?.invoice_count || 0} />
      </div>

      {!readonly && data?.summary?.outstanding > 0 && onCollectPayment && (
        <Button onClick={onCollectPayment} className="bg-[#0D9488] hover:bg-[#0B7E73]">
          <IndianRupee className="w-4 h-4 mr-1.5" />Collect Payment
        </Button>
      )}

      <Card className="rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h3 className="text-sm font-semibold">Invoice History</h3>
        </div>
        {!data?.invoices?.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No invoices yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30">
                <tr>
                  <th className="px-4 py-2 text-left">Invoice</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map(inv => (
                  <tr key={inv.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{inv.invoice_number || inv.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtPatientDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3">{inr(inv.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColor(inv.payment_status)}`}>{inv.payment_status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{inr(inv.balance_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )

  return (
    <PatientSectionGate flag="billing" readOnlyContent={readonly ? content : null}>
      {content}
    </PatientSectionGate>
  )
}

function MetricCard({ label, value, alert }) {
  return (
    <Card className={`p-4 rounded-xl ${alert ? 'bg-amber-50 border-amber-200' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 ${alert ? 'text-amber-700' : ''}`}>{value}</div>
    </Card>
  )
}

function statusColor(s) {
  return { paid: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700', partial: 'bg-orange-100 text-orange-700' }[s] || 'bg-slate-100 text-slate-600'
}
