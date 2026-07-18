'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthSplit } from '@/components/dentos/AuthSplit'

function App() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (!email.trim()) { setErr('Please enter your email'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Request failed'); return }
      setSent(true)
    } catch {
      setErr('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplit>
      <h1 className="text-3xl font-bold text-foreground">Reset your password</h1>
      <p className="text-muted-foreground mt-1">Enter your email and we&apos;ll send you a reset link</p>
      {sent ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, a reset link has been sent. Check your inbox and spam folder. The link expires in 1 hour.
          </p>
          <Link href="/login" className="text-sm text-[#0D9488] hover:underline inline-block">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@clinic.com" autoFocus />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Send reset link'}
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

export default App
