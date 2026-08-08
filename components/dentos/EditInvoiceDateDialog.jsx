'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const todayIso = () => new Date().toISOString().slice(0, 10)

const fmtDateLong = d =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

export function EditInvoiceDateDialog({ open, onClose, invoice, onSaved }) {
  const [newDate, setNewDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && invoice) {
      setNewDate('')
      setReason('')
    }
  }, [open, invoice])

  const currentDate = invoice?.invoice_date
  const reasonOk = reason.trim().length > 0
  const dateOk = newDate && newDate <= todayIso()
  const changed = newDate && newDate !== currentDate
  const canSave = reasonOk && dateOk && changed && !saving

  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const r = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_date: newDate,
          invoice_date_update_reason: reason.trim(),
        }),
      })
      const data = await r.json()
      if (r.ok && data.invoice) {
        toast.success('Invoice date updated')
        onClose()
        onSaved?.(data.invoice)
      } else {
        toast.error(data.error || 'Failed to update invoice date')
      }
    } catch {
      toast.error('Failed to update invoice date')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Invoice Date</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Current Date</Label>
            <div className="text-sm font-medium">{fmtDateLong(currentDate)}</div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-invoice-date">New Date</Label>
            <Input
              id="new-invoice-date"
              type="date"
              max={todayIso()}
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice-date-reason">Reason *</Label>
            <Textarea
              id="invoice-date-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Insurance reimbursement, Billing correction, Corporate claim"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="bg-[#0D9488] hover:bg-[#0B7E73]"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { fmtDateLong }
