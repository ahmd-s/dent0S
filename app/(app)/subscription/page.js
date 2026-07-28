'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CreditCard, Zap, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Script from 'next/script'
import { toast } from 'sonner'

const PLAN_COPY = {
  monthly: { label: 'Monthly', price: '₹999', period: 'per month' },
  yearly: { label: 'Yearly', price: '₹9,999', period: 'per year', save: 'Save ₹1,989' },
}

function statusBadgeVariant(displayStatus) {
  if (displayStatus === 'active') return 'default'
  if (displayStatus === 'blocked') return 'destructive'
  if (displayStatus === 'trial') return 'secondary'
  return 'outline'
}

function formatStatusLabel(displayStatus) {
  if (displayStatus === 'blocked') return 'Blocked'
  if (displayStatus === 'trial') return 'Trial'
  if (displayStatus === 'active') return 'Active'
  return displayStatus ? String(displayStatus).charAt(0).toUpperCase() + String(displayStatus).slice(1) : '—'
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [rzpLoaded, setRzpLoaded] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
      </div>
    )
  }

  if (data && data.is_admin === false) {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="p-6 border-border">
          <div className="flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">Admin access required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Only clinic admins can manage subscription and billing. Contact your clinic administrator.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/dashboard')}>
                Back to dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const subscription = data?.subscription
  const displayStatus = data?.display_status || 'trial'
  const trialDays = data?.trial_days_remaining ?? 0
  const trialEnds = data?.clinic_access?.trial_ends_at
  const planType = subscription?.plan_type
  const showPlans = displayStatus === 'blocked' || displayStatus === 'trial' ||
    subscription?.subscription_status === 'halted' || subscription?.subscription_status === 'cancelled'

  const subscribe = async planTypeChoice => {
    if (subscribing || !rzpLoaded) return
    setSubscribing(true)
    try {
      const r = await fetch('/api/subscriptions/create-razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: planTypeChoice }),
      })
      const resData = await r.json()
      if (!r.ok) {
        toast.error(resData.error || 'Failed to start checkout')
        setSubscribing(false)
        return
      }
      const rzp = new window.Razorpay({
        key: resData.razorpay_key,
        subscription_id: resData.subscription_id,
        name: 'DentOS',
        description: planTypeChoice === 'monthly' ? '₹999/month' : '₹9,999/year',
        handler: async function () {
          const confirm = await fetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan_type: planTypeChoice,
              razorpay_subscription_id: resData.subscription_id,
              razorpay_plan_id: resData.plan_id,
            }),
          })
          if (!confirm.ok) {
            const d = await confirm.json().catch(() => ({}))
            toast.error(d.error || 'Payment recorded but activation failed — contact support')
            setSubscribing(false)
            return
          }
          toast.success('Subscription activated!')
          load()
          setSubscribing(false)
        },
        modal: { ondismiss: () => setSubscribing(false) },
        theme: { color: '#0D9488' },
      })
      rzp.open()
    } catch {
      toast.error('Failed to open checkout')
      setSubscribing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRzpLoaded(true)} />

      <div>
        <h1 className="text-2xl font-bold">Subscription &amp; Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your clinic&apos;s DentOS subscription</p>
      </div>

      <Card className="p-6 bg-card border-border rounded-lg">
        {!subscription ? (
          <p className="text-muted-foreground text-sm">No subscription record found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge variant={statusBadgeVariant(displayStatus)} className="mt-1 capitalize">
                  {formatStatusLabel(displayStatus)}
                </Badge>
              </div>
              {planType && (
                <div>
                  <div className="text-sm text-muted-foreground">Current plan</div>
                  <div className="font-semibold capitalize">
                    {PLAN_COPY[planType]?.label || planType}{' '}
                    <span className="text-muted-foreground font-normal">
                      ({PLAN_COPY[planType]?.price}/{planType === 'monthly' ? 'mo' : 'yr'})
                    </span>
                  </div>
                </div>
              )}
              {displayStatus === 'trial' && (
                <div>
                  <div className="text-sm text-muted-foreground">Trial ends</div>
                  <div className="font-semibold">
                    {trialEnds ? new Date(trialEnds).toLocaleDateString('en-IN') : '—'}
                    <span className="text-orange-600 text-sm ml-2">({trialDays} days left)</span>
                  </div>
                </div>
              )}
              {displayStatus === 'active' && subscription.current_period_end && (
                <div>
                  <div className="text-sm text-muted-foreground">Renews on</div>
                  <div className="font-semibold">
                    {new Date(subscription.current_period_end).toLocaleDateString('en-IN')}
                  </div>
                </div>
              )}
              {displayStatus === 'blocked' && (
                <div>
                  <div className="text-sm text-muted-foreground">Access</div>
                  <p className="text-sm text-destructive max-w-md">
                    New actions are paused until you subscribe. Existing patient records remain available.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {showPlans && (
        <Card className="p-6 border-border">
          <h2 className="font-semibold mb-1">
            {displayStatus === 'blocked' ? 'Resubscribe to restore access' : 'Choose your plan'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Secure payment via Razorpay. Recurring billing on your selected plan.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4 text-center border">
              <div className="font-semibold mb-1">Monthly</div>
              <div className="text-3xl font-bold mb-1">₹999</div>
              <div className="text-sm text-muted-foreground mb-4">per month</div>
              <Button onClick={() => subscribe('monthly')} disabled={subscribing || !rzpLoaded} className="w-full bg-[#0D9488] hover:bg-[#0B7E73]">
                {subscribing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <CreditCard className="w-4 h-4 mr-2"/>}
                Subscribe monthly
              </Button>
            </Card>
            <Card className="p-4 text-center border-2 border-[#0D9488] relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0D9488] text-white text-xs px-3 py-1 rounded-full">Best value</div>
              <div className="font-semibold mb-1">Yearly</div>
              <div className="text-3xl font-bold mb-1">₹9,999</div>
              <div className="text-sm text-muted-foreground mb-1">per year</div>
              <div className="text-xs text-[#0D9488] mb-4">Save ₹1,989</div>
              <Button onClick={() => subscribe('yearly')} disabled={subscribing || !rzpLoaded} className="w-full bg-[#0D9488] hover:bg-[#0B7E73]">
                {subscribing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Zap className="w-4 h-4 mr-2"/>}
                Subscribe yearly
              </Button>
            </Card>
          </div>
        </Card>
      )}

      {displayStatus === 'active' && !showPlans && (
        <Card className="p-4 border-border text-sm text-muted-foreground">
          Your subscription is active. To change plans, contact Connec8 support.
        </Card>
      )}
    </div>
  )
}
