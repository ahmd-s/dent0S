'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthSplit } from '@/components/dentos/AuthSplit'
import { toast } from 'sonner'

export default function GoogleCompleteSignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [profile, setProfile] = useState({ email: '', full_name: '' })
  const [phone, setPhone] = useState('')
  const [clinicName, setClinicName] = useState('')

  useEffect(() => {
    fetch('/api/auth/google/pending')
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          router.replace('/login')
          return
        }
        setProfile({ email: d.email, full_name: d.full_name })
        setLoading(false)
      })
      .catch(() => router.replace('/login'))
  }, [router])

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (!clinicName.trim()) { setErr('Clinic name is required'); return }
    if (!/^\d{10}$/.test(phone)) { setErr('Phone must be exactly 10 digits'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/auth/google/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, clinic_name: clinicName.trim() }),
      })
      const d = await r.json()
      if (!r.ok) {
        setErr(d.error || 'Could not create account')
        return
      }
      toast.success('Welcome to DentOS!')
      router.push(d.onboarding_complete ? '/dashboard' : '/onboarding')
    } catch {
      setErr('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AuthSplit>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" />
        </div>
      </AuthSplit>
    )
  }

  return (
    <AuthSplit>
      <h1 className="text-3xl font-bold text-foreground">Finish setting up</h1>
      <p className="text-muted-foreground mt-1">A few details to create your clinic</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="space-y-1.5">
          <Label>Full Name</Label>
          <Input value={profile.full_name} readOnly className="bg-muted" />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={profile.email} readOnly className="bg-muted" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone Number</Label>
          <div className="flex">
            <span className="px-3 flex items-center bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">+91</span>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              className="rounded-l-none"
              autoFocus
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Clinic Name</Label>
          <Input value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="Sharma Dental Care" />
        </div>
        <Button type="submit" disabled={submitting} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11 mt-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create clinic'}
        </Button>
        {err && <p className="text-sm text-[#EF4444]">{err}</p>}
      </form>
      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/login" className="text-[#0D9488] font-medium hover:underline">Back to sign in</Link>
      </p>
    </AuthSplit>
  )
}
