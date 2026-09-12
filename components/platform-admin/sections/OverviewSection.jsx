'use client'
import { Card, CardContent } from '@/components/ui/card'
import { AccessBadge, BillingBadge, ConsoleStatusBadge, PlanBadge } from '@/components/platform-admin/Badges'
import { DetailCard } from '@/components/platform-admin/StatCard'
import { SectionHeading } from '@/components/platform-admin/Placeholder'
import { fmtDate, fmtDateTime, fmtRelative, initials } from '@/components/platform-admin/format'

export default function OverviewSection({ clinic }) {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Overview"
        description="Identity, status and headline activity for this clinic."
      />

      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
            {initials(clinic.name)}
          </span>
          <div className="min-w-0 space-y-2">
            <h3 className="truncate text-xl font-semibold tracking-tight text-foreground">{clinic.name}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <ConsoleStatusBadge status={clinic.console_status} />
              <AccessBadge status={clinic.subscription_status} />
              <PlanBadge plan={clinic.plan_type} />
              <BillingBadge status={clinic.billing_status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Clinic ID <span className="font-mono">{clinic.id}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DetailCard label="Created" value={fmtDate(clinic.created_at)} />
        <DetailCard
          label="Onboarding"
          value={clinic.onboarding_complete ? 'Complete' : 'Incomplete'}
          hint={clinic.onboarding_complete ? undefined : 'Clinic has not finished setup'}
        />
        <DetailCard label="Current plan" value={clinic.plan_type ? clinic.plan_type : 'No plan'} />
        <DetailCard label="Trial ends" value={fmtDate(clinic.trial_ends_at)} />
        <DetailCard label="Last activity" value={fmtRelative(clinic.last_activity)} hint={fmtDateTime(clinic.last_activity)} />
        <DetailCard label="Last staff login" value={fmtRelative(clinic.last_staff_login)} hint={fmtDateTime(clinic.last_staff_login)} />
        <DetailCard label="Doctors" value={clinic.doctor_count ?? 0} />
        <DetailCard label="Receptionists" value={clinic.receptionist_count ?? 0} />
        <DetailCard label="Patients" value={clinic.patient_count ?? 0} />
        <DetailCard label="Appointments" value={clinic.appointment_count ?? 0} />
        <DetailCard label="Storage" value={clinic.storage_files != null ? `${clinic.storage_files} files` : '—'} />
        <DetailCard label="Version" value={clinic.version || '1.0.0'} />
      </div>
    </div>
  )
}
