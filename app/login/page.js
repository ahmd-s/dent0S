'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthSplit } from '@/components/dentos/AuthSplit'
import { toast } from 'sonner'

function App() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token') || document.cookie.includes('token')
    if (token) {
      router.replace('/dashboard')
    }
  }, [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (!email || !password) { setErr('Please fill all fields'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password })
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Login failed'); return }
      toast.success('Welcome back!')
      if (d.onboarding_complete) router.push('/dashboard')
      else router.push('/onboarding')
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }

  return (
    <AuthSplit>
      <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
      <p className="text-muted-foreground mt-1">Sign in to your clinic</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@clinic.com" autoFocus />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <div className="relative">
            <Input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} className="pr-10" />
            <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
            </button>
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11">
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Sign In'}
        </Button>
        {err && <p className="text-sm text-[#EF4444]">{err}</p>}
        <div className="text-center">
          <Link href="#" className="text-sm text-[#0D9488] hover:underline">Forgot password?</Link>
        </div>
      </form>
      <div className="flex items-center gap-3 my-6"><div className="flex-1 h-px bg-border"/><span className="text-xs text-muted-foreground">OR</span><div className="flex-1 h-px bg-border"/></div>
      <p className="text-center text-sm">New to DentOS? <Link href="/signup" className="text-[#0D9488] font-medium hover:underline">Create your clinic</Link></p>
    </AuthSplit>
  )
}

export default App
