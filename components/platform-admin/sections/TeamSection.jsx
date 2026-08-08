'use client'
import { Shield, Stethoscope, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PendingNotice, SectionHeading } from '@/components/platform-admin/Placeholder'

const ROLES = [
  { label: 'Doctors', icon: Stethoscope, description: 'Clinicians with patient and visit access.' },
  { label: 'Receptionists', icon: UserCog, description: 'Front-desk staff managing appointments and billing.' },
  { label: 'Admins', icon: Shield, description: 'Clinic owners and administrators.' },
]

export default function TeamSection() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Team"
        description="Staff accounts inside this clinic."
      />

      <PendingNotice>
        Team rosters are read from clinic-scoped data and become available in Sprint 2.
      </PendingNotice>

      <div className="grid gap-4 lg:grid-cols-3">
        {ROLES.map(role => {
          const Icon = role.icon
          return (
            <Card key={role.label} className="border-dashed border-border/70 bg-muted/20 shadow-none">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{role.label}</CardTitle>
                </div>
                <CardDescription>{role.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-3xl font-semibold leading-none text-muted-foreground/60">—</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled>View</Button>
                  <Button size="sm" variant="outline" disabled>Deactivate</Button>
                  <Button size="sm" variant="outline" disabled>Reset password</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
