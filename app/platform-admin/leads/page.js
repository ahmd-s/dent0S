'use client'

import { UserPlus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClinicsTable } from '@/components/platform-admin/ClinicsTable'

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserPlus className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead tracking</h1>
          <p className="text-sm text-muted-foreground">
            Clinics that signed up but went quiet. Follow up before the trial goes cold.
          </p>
        </div>
      </div>
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Quiet clinics</CardTitle>
          <CardDescription>Filtered to 14+ days without activity. Change the inactivity filter to widen or narrow the list.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClinicsTable defaultInactivity="14" />
        </CardContent>
      </Card>
    </div>
  )
}
