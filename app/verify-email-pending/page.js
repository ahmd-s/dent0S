'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthSplit } from '@/components/dentos/AuthSplit'

function PendingForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email') || ''
  const emailSent = searchParams.get('sent') !== '0'

  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [resent, setResent] = useState(false)

  const resend = async e => {
    e.preventDefault()
    setErr('')
    if (!email.trim()) { setErr('Please enter your email'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Request failed'); return }
      setResent(true)
    } catch {
      setErr('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplit>
      <Mail className="w-12 h-12 text-[#0D9488] mb-2" />
      <h1 className="text-3xl font-bold text-foreground">Check your inbox</h1>
      <p className="text-muted-foreground mt-1">
        {emailSent
          ? 'We sent a verification link to your email. Click the link to activate your account, then sign in.'
          : 'Your account was created, but we could not send the verification email. Enter your email below to resend the link.'}
      </p>
      {resent ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            If an unverified account exists for that email, a verification link has been sent. Check your inbox and spam folder. The link expires in 24 hours.
          </p>
          <Link href="/login" className="text-sm text-[#0D9488] hover:underline inline-block">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={resend} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@clinic.com" autoFocus />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Resend verification email'}
          </Button>
          {err && <p className="text-sm text-[#EF4444]">{err}</p>}
          <p className="text-center text-sm">
            <Link href="/login" className="text-[#0D9488] hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthSplit>
  )
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={
      <AuthSplit>
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>
      </AuthSplit>
    }>
      <PendingForm />
    </Suspense>
  )
}
