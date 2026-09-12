'use client'

import { Building2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClinicsTable } from '@/components/platform-admin/ClinicsTable'

export default function ClinicsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clinics</h1>
          <p className="text-sm text-muted-foreground">Manage lifecycle, plans, and access for every tenant.</p>
        </div>
      </div>
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>All clinics</CardTitle>
          <CardDescription>Click a row for the details drawer. Use the full control center when you need diagnostics or security tools.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClinicsTable />
        </CardContent>
      </Card>
    </div>
  )
}
