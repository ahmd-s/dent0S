'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PendingNotice, SectionHeading } from '@/components/platform-admin/Placeholder'
import { fmtDate, fmtDateTime, fmtMoney } from '@/components/platform-admin/format'

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  method: '',
  note: '',
})

export default function PaymentsSection({ clinic, onClinicUpdate }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/payments`)
      if (!r.ok) {
        toast.error('Failed to load payments')
        return
      }
      const d = await r.json()
      setPayments(d.payments || [])
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [clinic.id])

  useEffect(() => { loadPayments() }, [loadPayments])

  const submitPayment = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error || 'Failed to record payment')
        return
      }
      toast.success('Payment recorded — clinic access restored')
      setForm(f => ({ ...f, amount: '', method: '', note: '' }))
      const d = await r.json()
      onClinicUpdate?.({
        subscription_status: d.subscription_status,
        billing_status: d.billing_status,
        subscription_reason: d.subscription_reason,
        grace_period_end: d.grace_period_end,
        days_remaining: null,
        grace_days_remaining: null,
        is_in_grace: false,
      })
      await loadPayments()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Payments"
        description="Manually recorded payments for this clinic."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="order-2 xl:order-1">
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
            <CardDescription>Newest first, as recorded by the platform team.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
              </div>
            ) : payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                No payments logged yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="px-4 py-3">Date</TableHead>
                      <TableHead className="px-4 py-3 text-right">Amount</TableHead>
                      <TableHead className="px-4 py-3">Method</TableHead>
                      <TableHead className="px-4 py-3">Recorded by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="px-4 py-3 whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                        <TableCell className="px-4 py-3 text-right font-medium tabular-nums">{fmtMoney(p.amount)}</TableCell>
                        <TableCell className="px-4 py-3">{p.method}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                          {p.recorded_by_email || '—'}
                          <div>{fmtDateTime(p.recorded_at)}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="order-1 h-fit xl:order-2">
          <CardHeader>
            <CardTitle className="text-base">Record manual payment</CardTitle>
            <CardDescription>Logged for reconciliation — does not change billing state.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitPayment} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="pay-date">Date</Label>
                <Input
                  id="pay-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-amount">Amount (INR)</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-method">Method</Label>
                <Input
                  id="pay-method"
                  placeholder="UPI, bank transfer, …"
                  required
                  value={form.method}
                  onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-note">Note (optional)</Label>
                <Input
                  id="pay-note"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add payment
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing timeline</CardTitle>
          <CardDescription>Invoices, renewals and Razorpay events in one thread.</CardDescription>
        </CardHeader>
        <CardContent>
          <PendingNotice>Billing timeline arrives in Sprint 2.</PendingNotice>
        </CardContent>
      </Card>
    </div>
  )
}
