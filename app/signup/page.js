'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthSplit } from '@/components/dentos/AuthSplit'
import { toast } from 'sonner'

function App() {
  const router = useRouter()
  const [f, setF] = useState({ full_name:'', email:'', phone:'', clinic_name:'', password:'', confirm:'' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k,v) => setF(p => ({...p, [k]:v}))

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (Object.values(f).some(v=>!v)) { setErr('All fields required'); return }
    if (!/^\d{10}$/.test(f.phone)) { setErr('Phone must be exactly 10 digits'); return }
    if (f.password.length < 8) { setErr('Password must be at least 8 characters'); return }
    if (f.password !== f.confirm) { setErr('Passwords do not match'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { setErr('Invalid email'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(f) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Signup failed'); return }
      toast.success('Clinic created! Let\'s set things up.')
      router.push('/onboarding')
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }

  return (
    <AuthSplit>
      <h1 className="text-3xl font-bold text-foreground">Start your free trial</h1>
      <p className="text-muted-foreground mt-1">Set up your clinic in 2 minutes</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="space-y-1.5"><Label>Full Name</Label><Input value={f.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="Dr. Priya Sharma" /></div>
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={e=>set('email',e.target.value)} placeholder="you@clinic.com" /></div>
        <div className="space-y-1.5"><Label>Phone Number</Label>
          <div className="flex"><span className="px-3 flex items-center bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">+91</span>
            <Input value={f.phone} onChange={e=>set('phone',e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="9876543210" className="rounded-l-none" /></div></div>
        <div className="space-y-1.5"><Label>Clinic Name</Label><Input value={f.clinic_name} onChange={e=>set('clinic_name',e.target.value)} placeholder="Sharma Dental Care" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={f.password} onChange={e=>set('password',e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Confirm</Label><Input type="password" value={f.confirm} onChange={e=>set('confirm',e.target.value)} /></div>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11 mt-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Create Account'}
        </Button>
        {err && <p className="text-sm text-[#EF4444]">{err}</p>}
      </form>
      <p className="text-center text-sm mt-6">Already have an account? <Link href="/login" className="text-[#0D9488] font-medium hover:underline">Sign in</Link></p>
    </AuthSplit>
  )
}

export default App
