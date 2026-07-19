'use client'
import { useEffect, useState } from 'react'
import { Loader2, CreditCard, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Script from 'next/script'

function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null)
  const [trialDays, setTrialDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [rzpLoaded, setRzpLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/subscriptions').then(r => r.json()).then(d => {
      setSubscription(d.subscription)
      setTrialDays(d.trial_days_remaining || 0)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const subscribe = async (planType) => {
    if (subscribing || !rzpLoaded) return
    setSubscribing(true)
    try {
      const r = await fetch('/api/subscriptions/create-razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: planType })
      })
      const data = await r.json()
      if (!r.ok) { alert(data.error || 'Failed'); setSubscribing(false); return }
      const rzp = new window.Razorpay({
        key: data.razorpay_key,
        subscription_id: data.subscription_id,
        name: 'DentOS',
        description: planType === 'monthly' ? '₹999/month' : '₹9,999/year',
        handler: async function() {
          await fetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_type: planType, razorpay_subscription_id: data.subscription_id, razorpay_plan_id: data.plan_id })
          })
          alert('Subscription activated!')
          window.location.reload()
        },
        modal: { ondismiss: () => setSubscribing(false) },
        theme: { color: '#0D9488' }
      })
      rzp.open()
    } catch { alert('Failed'); setSubscribing(false) }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-6 bg-card border-border rounded-lg">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRzpLoaded(true)} />
        <h3 className="font-semibold mb-4">Subscription</h3>
        {loading ? (
          <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto"/></div>
        ) : !subscription ? (
          <p className="text-muted-foreground text-sm">No subscription found</p>
        ) : (
          <div className="mb-6">
            <div className="flex gap-8 mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="font-semibold capitalize">{subscription.subscription_status}</div>
              </div>
              {subscription.subscription_status === 'trial' && (
                <div>
                  <div className="text-sm text-muted-foreground">Trial Days Left</div>
                  <div className="font-semibold text-orange-600">{trialDays} days</div>
                </div>
              )}
              {subscription.subscription_status === 'active' && subscription.current_period_end && (
                <div>
                  <div className="text-sm text-muted-foreground">Next Billing</div>
                  <div className="font-semibold">{new Date(subscription.current_period_end).toLocaleDateString('en-IN')}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {subscription && (subscription.subscription_status === 'trial' || subscription.subscription_status === 'expired') && (
          <div>
            <h4 className="font-semibold mb-4">Choose Your Plan</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 text-center border">
                <div className="font-semibold mb-1">Monthly</div>
                <div className="text-3xl font-bold mb-1">₹999</div>
                <div className="text-sm text-muted-foreground mb-4">per month</div>
                <Button onClick={() => subscribe('monthly')} disabled={subscribing} className="w-full bg-[#0D9488] hover:bg-[#0B7E73]">
                  {subscribing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <CreditCard className="w-4 h-4 mr-2"/>}
                  Subscribe Monthly
                </Button>
              </Card>
              <Card className="p-4 text-center border-2 border-[#0D9488] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0D9488] text-white text-xs px-3 py-1 rounded-full">BEST VALUE</div>
                <div className="font-semibold mb-1">Yearly</div>
                <div className="text-3xl font-bold mb-1">₹9,999</div>
                <div className="text-sm text-muted-foreground mb-1">per year</div>
                <div className="text-xs text-[#0D9488] mb-4">Save ₹1,989</div>
                <Button onClick={() => subscribe('yearly')} disabled={subscribing} className="w-full bg-[#0D9488] hover:bg-[#0B7E73]">
                  {subscribing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Zap className="w-4 h-4 mr-2"/>}
                  Subscribe Yearly
                </Button>
              </Card>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default SubscriptionPage
