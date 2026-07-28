'use client'
import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { AuthSplit } from '@/components/dentos/AuthSplit'
import { GoogleSignInButton, AuthOrDivider } from '@/components/dentos/GoogleSignInButton'
import { oauthLoginErrorMessage } from '@/lib/oauth-login-error-message'
import { toast } from 'sonner'

const FOUNDER_QR_NOTE = 'Both founders should scan this same QR code into their own authenticator app now — it will not be shown again after setup is confirmed.'
const OAUTH_ERROR_PARAM = 'oauth_error'

function consumeOAuthErrorFromBrowserUrl() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const code = params.get(OAUTH_ERROR_PARAM)
  if (!code) return null
  params.delete(OAUTH_ERROR_PARAM)
  const rest = params.toString()
  const nextPath = rest ? `/login?${rest}` : '/login'
  window.history.replaceState(null, '', nextPath)
  return code
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const googlePlatformAdmin = searchParams.get('google_platform_admin')
  const oauthHandled = useRef(false)

  const [step, setStep] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [oauthErrMessage, setOauthErrMessage] = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [setupRequired, setSetupRequired] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [totpCode, setTotpCode] = useState('')

  // OAuth failures must come from the real browser URL (document navigation from /api/auth/google),
  // not useSearchParams() alone — Next can briefly expose a stale ?error= from router cache.
  useEffect(() => {
    if (oauthHandled.current) return
    const code = consumeOAuthErrorFromBrowserUrl()
    if (!code) return
    oauthHandled.current = true
    const msg = oauthLoginErrorMessage(code)
    setOauthErrMessage(msg)
    toast.error(msg)
  }, [])

  useEffect(() => {
    if (googlePlatformAdmin !== '1') return
    fetch('/api/auth/google/platform-pending')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return
        setPendingToken(d.pending_token)
        setSetupRequired(!!d.setup_required)
        setTotpCode('')
        setQrDataUrl('')
        setStep(d.setup_required ? 'setup' : 'verify')
      })
      .catch(() => {})
  }, [googlePlatformAdmin])

  const loadSetupQr = useCallback(async (token) => {
    setLoading(true)
    setFormErr('')
    try {
      const r = await fetch('/api/auth/platform-admin/setup-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_token: token }),
      })
      const d = await r.json()
      if (!r.ok) { setFormErr(d.error || 'Setup failed'); return }
      setQrDataUrl(d.qr_data_url || '')
    } catch {
      setFormErr('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step === 'setup' && pendingToken && !qrDataUrl) {
      loadSetupQr(pendingToken)
    }
  }, [step, pendingToken, qrDataUrl, loadSetupQr])

  const displayErr = formErr || oauthErrMessage

  const submitPassword = async e => {
    e.preventDefault()
    setFormErr('')
    if (!email || !password) { setFormErr('Please fill all fields'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const d = await r.json()
      if (!r.ok) {
        if (r.status === 403 && d.error?.includes('verify your email')) {
          setFormErr(d.error)
          return
        }
        setFormErr(d.error || 'Login failed')
        return
      }

      if (d.requires_platform_2fa) {
        setPendingToken(d.pending_token)
        setSetupRequired(!!d.setup_required)
        setTotpCode('')
        setQrDataUrl('')
        setStep(d.setup_required ? 'setup' : 'verify')
        return
      }

      if (d.is_platform_admin) {
        setFormErr('Platform admin sign-in requires two-factor authentication.')
        return
      }

      toast.success('Welcome back!')
      if (d.onboarding_complete) router.push('/dashboard')
      else router.push('/onboarding')
    } catch {
      setFormErr('Network error')
    } finally {
      setLoading(false)
    }
  }

  const submitTotp = async e => {
    e.preventDefault()
    setFormErr('')
    if (totpCode.length !== 6) { setFormErr('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const url = setupRequired
        ? '/api/auth/platform-admin/setup-totp/confirm'
        : '/api/auth/platform-admin/verify-totp'
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_token: pendingToken, code: totpCode }),
      })
      const d = await r.json()
      if (!r.ok) {
        setFormErr(d.error || 'Verification failed')
        return
      }
      toast.success(setupRequired ? 'Two-factor authentication enabled' : 'Welcome back!')
      router.push('/platform-admin')
    } catch {
      setFormErr('Network error')
    } finally {
      setLoading(false)
    }
  }

  const backToPassword = () => {
    setStep('password')
    setPendingToken('')
    setTotpCode('')
    setQrDataUrl('')
    setFormErr('')
  }

  if (step === 'setup') {
    return (
      <AuthSplit>
        <h1 className="text-3xl font-bold text-foreground">Set up two-factor auth</h1>
        <p className="text-muted-foreground mt-1">Scan the QR code, then enter the 6-digit code to confirm.</p>
        <div className="mt-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            {loading && !qrDataUrl ? (
              <Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" />
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="TOTP QR code" className="rounded-lg border border-border" width={220} height={220} />
            ) : null}
            <p className="text-sm text-muted-foreground text-center max-w-sm">{FOUNDER_QR_NOTE}</p>
          </div>
          <form onSubmit={submitTotp} className="space-y-4">
            <div className="space-y-2">
              <Label>Verification code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={totpCode} onChange={setTotpCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <Button type="submit" disabled={loading || totpCode.length !== 6} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm setup'}
            </Button>
            {displayErr && <p className="text-sm text-[#EF4444]">{displayErr}</p>}
            <Button type="button" variant="ghost" className="w-full" onClick={backToPassword}>Back</Button>
          </form>
        </div>
      </AuthSplit>
    )
  }

  if (step === 'verify') {
    return (
      <AuthSplit>
        <h1 className="text-3xl font-bold text-foreground">Two-factor authentication</h1>
        <p className="text-muted-foreground mt-1">Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={submitTotp} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label>Verification code</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={totpCode} onChange={setTotpCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button type="submit" disabled={loading || totpCode.length !== 6} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
          </Button>
          {displayErr && <p className="text-sm text-[#EF4444]">{displayErr}</p>}
          <Button type="button" variant="ghost" className="w-full" onClick={backToPassword}>Back</Button>
        </form>
      </AuthSplit>
    )
  }

  return (
    <AuthSplit>
      <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
      <p className="text-muted-foreground mt-1">Sign in to your clinic</p>
      <form onSubmit={submitPassword} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@clinic.com" autoFocus />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <div className="relative">
            <Input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="pr-10" />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-[#0D9488] hover:bg-[#0B7E73] h-11">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
        </Button>
        {displayErr && (
          <div className="space-y-2">
            <p className="text-sm text-[#EF4444]">{displayErr}</p>
            {displayErr.includes('verify your email') && email && (
              <p className="text-sm text-center">
                <Link href={`/verify-email-pending?email=${encodeURIComponent(email)}`} className="text-[#0D9488] hover:underline">
                  Resend verification email
                </Link>
              </p>
            )}
          </div>
        )}
        <div className="text-center">
          <Link href="/forgot-password" className="text-sm text-[#0D9488] hover:underline">Forgot password?</Link>
        </div>
      </form>
      <AuthOrDivider />
      <GoogleSignInButton />
      <p className="text-center text-sm mt-6">New to DentOS? <Link href="/signup" className="text-[#0D9488] font-medium hover:underline">Create your clinic</Link></p>
    </AuthSplit>
  )
}

function LoginFallback() {
  return (
    <AuthSplit>
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" />
      </div>
    </AuthSplit>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}
