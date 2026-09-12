'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeading } from '@/components/platform-admin/Placeholder'
import { DetailCard } from '@/components/platform-admin/StatCard'
import { fmtDate, fmtRelative } from '@/components/platform-admin/format'

export default function UsageSection({ clinic, onClinicUpdate }) {
  const [aiLimit, setAiLimit] = useState(
    clinic.monthly_ai_usage_limit != null ? String(clinic.monthly_ai_usage_limit) : ''
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAiLimit(clinic.monthly_ai_usage_limit != null ? String(clinic.monthly_ai_usage_limit) : '')
  }, [clinic.monthly_ai_usage_limit])

  const saveAiLimit = async () => {
    const raw = aiLimit.trim()
    const monthly_ai_usage_limit = raw === '' ? null : Number(raw)
    if (raw !== '' && (!Number.isFinite(monthly_ai_usage_limit) || monthly_ai_usage_limit < 0)) {
      toast.error('Enter a valid non-negative number or leave empty')
      return
    }
    setSaving(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_ai_usage_limit }),
      })
      if (!r.ok) {
        toast.error('Failed to save AI limit')
        return
      }
      const updated = await r.json()
      toast.success('AI usage limit saved')
      onClinicUpdate({ monthly_ai_usage_limit: updated.monthly_ai_usage_limit })
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Usage"
        description="Consumption across the clinic workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DetailCard label="Doctors" value={clinic.doctor_count ?? 0} />
        <DetailCard label="Receptionists" value={clinic.receptionist_count ?? 0} />
        <DetailCard label="Patients" value={clinic.patient_count ?? 0} />
        <DetailCard label="Appointments" value={clinic.appointment_count ?? 0} />
        <DetailCard label="Visits" value={clinic.visit_count ?? 0} />
        <DetailCard label="Invoices" value={clinic.invoice_count ?? 0} />
        <DetailCard label="Documents" value={clinic.document_count ?? clinic.storage_files ?? 0} />
        <DetailCard label="Revenue" value={clinic.revenue_total != null ? `₹${Number(clinic.revenue_total).toLocaleString('en-IN')}` : '—'} />
        <DetailCard label="Sessions" value={clinic.session_count ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DetailCard label="Last visit recorded" value={fmtDate(clinic.last_visit_date)} />
        <DetailCard label="Last staff login" value={fmtRelative(clinic.last_staff_login)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly AI usage limit</CardTitle>
          <CardDescription>
            Stored for future enforcement only — does not block AI features today.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid w-full gap-2 sm:max-w-xs">
            <Label htmlFor="ai-limit">Requests per month</Label>
            <Input
              id="ai-limit"
              type="number"
              min="0"
              placeholder="Leave empty for no limit"
              value={aiLimit}
              onChange={e => setAiLimit(e.target.value)}
            />
          </div>
          <Button onClick={saveAiLimit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save limit
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
