'use client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AccessBadge, BillingBadge, PlanBadge, StatusBadge } from '@/components/platform-admin/Badges'
import { DetailCard } from '@/components/platform-admin/StatCard'
import { PlaceholderCard, SectionHeading } from '@/components/platform-admin/Placeholder'
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
              <StatusBadge active={clinic.is_active} />
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
        <DetailCard label="Trial ends" value="—" hint="Coming in Sprint 2" />
        <DetailCard label="Last activity" value={fmtRelative(clinic.last_activity)} hint={fmtDateTime(clinic.last_activity)} />
        <DetailCard label="Last staff login" value={fmtRelative(clinic.last_staff_login)} hint={fmtDateTime(clinic.last_staff_login)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clinic footprint</CardTitle>
          <CardDescription>
            These counters are wired to the UI but not yet exposed by the platform admin API.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <PlaceholderCard label="Doctors" />
          <PlaceholderCard label="Receptionists" />
          <PlaceholderCard label="Patients" />
          <PlaceholderCard label="Visits" />
          <PlaceholderCard label="Storage used" />
          <PlaceholderCard label="AI usage" />
        </CardContent>
      </Card>
    </div>
  )
}
