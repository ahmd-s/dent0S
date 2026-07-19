'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { AuthSplit } from '@/components/dentos/AuthSplit'

function VerifyForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/auth/confirm-email-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const d = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setStatus('error')
          setError(d.error || 'Verification failed')
          return
        }
        setStatus('success')
      } catch {
        if (!cancelled) {
          setStatus('error')
          setError('Network error')
        }
      }
    })()
    return () => { cancelled = true }
  }, [token])

  if (status === 'loading') {
    return (
      <AuthSplit>
        <div className="flex flex-col items-center py-12 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" />
          <p className="text-muted-foreground">Verifying your email...</p>
        </div>
      </AuthSplit>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthSplit>
        <XCircle className="w-12 h-12 text-[#EF4444] mb-2" />
        <h1 className="text-3xl font-bold text-foreground">Invalid verification link</h1>
        <p className="text-muted-foreground mt-1">This verification link is missing or invalid.</p>
        <p className="mt-6 text-sm">
          <Link href="/verify-email-pending" className="text-[#0D9488] hover:underline">Resend verification email</Link>
          {' · '}
          <Link href="/login" className="text-[#0D9488] hover:underline">Back to sign in</Link>
        </p>
      </AuthSplit>
    )
  }

  if (status === 'error') {
    return (
      <AuthSplit>
        <XCircle className="w-12 h-12 text-[#EF4444] mb-2" />
        <h1 className="text-3xl font-bold text-foreground">Verification failed</h1>
        <p className="text-muted-foreground mt-1">{error}</p>
        <p className="mt-6 text-sm">
          <Link href="/verify-email-pending" className="text-[#0D9488] hover:underline">Resend verification email</Link>
          {' · '}
          <Link href="/login" className="text-[#0D9488] hover:underline">Back to sign in</Link>
        </p>
      </AuthSplit>
    )
  }

  return (
    <AuthSplit>
      <CheckCircle2 className="w-12 h-12 text-[#0D9488] mb-2" />
      <h1 className="text-3xl font-bold text-foreground">Email verified</h1>
      <p className="text-muted-foreground mt-1">Your email has been verified. You can now sign in and complete clinic setup.</p>
      <p className="mt-6">
        <Link href="/login" className="text-[#0D9488] font-medium hover:underline">Continue to sign in</Link>
      </p>
    </AuthSplit>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <AuthSplit>
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>
      </AuthSplit>
    }>
      <VerifyForm />
    </Suspense>
  )
}
