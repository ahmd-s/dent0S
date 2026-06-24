'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { IndianRupee, ExternalLink, AlertCircle } from 'lucide-react'
import { useRole } from './RoleContext'
import { toast } from 'sonner'

const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

export default function OutstandingBalanceModal({ open, onOpenChange, patientId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const { isReceptionist } = useRole()
  const receptionist = isReceptionist()

  useEffect(() => {
    if (!open || !patientId) return

    const fetchBalance = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/patients/outstanding-balance?patient_id=${patientId}`)
        const balanceData = await res.json()
        if (res.ok) {
          setData(balanceData)
        } else {
          toast.error('Failed to load outstanding balance')
        }
      } catch (error) {
        console.error('Failed to fetch outstanding balance:', error)
        toast.error('Failed to load outstanding balance')
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [open, patientId])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Outstanding Balance
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : data && data.outstandingBalance > 0 ? (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Outstanding</div>
              <div className="text-2xl font-bold text-amber-700 flex items-center gap-2">
                <IndianRupee className="w-5 h-5" />
                {formatINR(data.outstandingBalance)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Unpaid Invoices</div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {data.unpaidInvoices.map((invoice) => (
                  <div
                    key={invoice._id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-900">{invoice.invoice_number}</span>
                      <span className="font-semibold text-amber-700">{formatINR(invoice.pending_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Date: {formatDate(invoice.date)}</span>
                      <span className="capitalize px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {invoice.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!receptionist && (
              <Button
                onClick={() => window.location.href = '/billing'}
                className="w-full bg-[#0D9488] hover:bg-[#0B7E73]"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Billing
              </Button>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No outstanding balance
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
