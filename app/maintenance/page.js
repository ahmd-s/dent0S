import Link from 'next/link'
import { Wrench } from 'lucide-react'

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mb-6">
        <Wrench className="h-8 w-8 text-amber-500" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Under Maintenance</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground" id="maintenance-message">
        DentOS is currently undergoing scheduled maintenance. We will be back shortly.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        If you need urgent assistance, contact{' '}
        <a href="mailto:support@dent-os.in" className="text-primary hover:underline">
          support@dent-os.in
        </a>
      </p>
    </div>
  )
}
