'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ImpersonationBanner({ clinicName, byEmail }) {
  const router = useRouter()
  const [exiting, setExiting] = useState(false)

  const exit = async () => {
    setExiting(true)
    try {
      await fetch('/api/auth/impersonate-exit', { method: 'POST' })
    } catch {
      // Non-fatal
    }
    // Close the tab if it was opened by the PA
    if (window.opener) {
      window.close()
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          You are impersonating <strong>{clinicName}</strong>
          {byEmail ? <span className="text-amber-600/70 dark:text-amber-500/70"> (authorized by {byEmail})</span> : null}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={exit}
        disabled={exiting}
        className="h-7 border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
      >
        <X className="mr-1.5 h-3.5 w-3.5" />
        Exit
      </Button>
    </div>
  )
}
