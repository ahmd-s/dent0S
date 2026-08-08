'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ShieldAlert } from 'lucide-react'

export default function ImpersonatePage() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setError('No impersonation token provided.')
      return
    }

    ;(async () => {
      try {
        const r = await fetch('/api/auth/impersonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const d = await r.json()
        if (!r.ok || !d.ok) {
          setError(d.error || 'Invalid or expired impersonation link.')
          return
        }
        router.replace(d.redirect || '/dashboard')
      } catch {
        setError('Network error. Please close this tab and try again.')
      }
    })()
  }, [params, router])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <ShieldAlert className="mb-4 h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold text-foreground">Impersonation Failed</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Opening clinic session…</p>
    </div>
  )
}
