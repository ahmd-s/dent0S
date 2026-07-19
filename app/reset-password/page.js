'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthSplit } from '@/components/dentos/AuthSplit'
import { toast } from 'sonner'

function ResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (!token) { setErr('Invalid reset link'); return }
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return }
    if (password !== confirm) { setErr('Passwords do not match'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/confirm-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Reset failed'); return }
      toast.success('Password updated. Please sign in.')
      router.push('/login')
    } catch {
      setErr('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthSplit>
        <h1 className="text-3xl font-bold text-foreground">Invalid reset link</h1>
        <p className="text-muted-foreground mt-1">This password reset link is missing or invalid.</p>
        <p className="mt-6 text-sm">
          <Link href="/forgot-password" className="text-[#0D9488] hover:underline">Request a new reset link</Link>
          {' · '}
          <Link href="/login" className="text-[#0D9488] hover:underline">Back to sign in</Link>
        </p>
      </AuthSplit>
    )
  }

  return (
    <AuthSplit>
      <h1 className="text-3xl font-bold text-foreground">Set a new password</h1>
      <p className="text-muted-foreground mt-1">Choose a new password for your account</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label>New password</Label>
          <div className="relative">
            <Input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} className="pr-10" autoFocus />
            <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Confirm password</Label>
          <Input type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11">
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Update password'}
        </Button>
        {err && <p className="text-sm text-[#EF4444]">{err}</p>}
        <p className="text-center text-sm">
          <Link href="/login" className="text-[#0D9488] hover:underline">Back to sign in</Link>
        </p>
      </form>
    </AuthSplit>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthSplit>
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>
      </AuthSplit>
    }>
      <ResetForm />
    </Suspense>
  )
}
