'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Copy, Loader2, MessageCircle, ShieldAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function WhatsAppCloudSetup() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState(null)
  const [accessToken, setAccessToken] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/communication/provider')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not load WhatsApp setup')
      setData(d)
      setPhoneNumberId(d.whatsapp?.phone_number_id || '')
      setWabaId(d.whatsapp?.waba_id || '')
      setAccessToken('')
    } catch (e) {
      toast.error(e.message || 'Could not load WhatsApp setup')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/communication/provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          access_token: accessToken || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not save')
      setData(d)
      setAccessToken('')
      toast.success(d.whatsapp?.configured
        ? 'WhatsApp Cloud API is live. Booking and visit messages will send automatically.'
        : 'Saved. Auto-send stays off until the access token and phone number ID are both set.')
    } catch (e) {
      toast.error(e.message || 'Could not save WhatsApp setup')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>
  }

  const wa = data?.whatsapp || {}
  const live = wa.configured && data?.provider_key === 'whatsapp_cloud'

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-4 border-border space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#0D9488]/10 text-[#0D9488]">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">WhatsApp Business Cloud API</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Booking confirmations, reminders, and visit summaries are already wired.
              Leave the keys empty until a WhatsApp Business account is allocated.
            </p>
          </div>
        </div>

        <div className={`rounded-md border px-3 py-2 text-sm ${live ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`}>
          {live ? (
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Auto-send is on. Messages go out through Cloud API.</span>
          ) : (
            <span className="flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Manual click-to-WhatsApp is active until the Business API token and phone number ID are saved.</span>
          )}
        </div>
      </Card>

      <Card className="p-4 border-border space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Credentials</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            From Meta WhatsApp → API Setup. You can also set these as Vercel env vars later:
            WHATSAPP_CLOUD_ACCESS_TOKEN, WHATSAPP_CLOUD_PHONE_NUMBER_ID, WHATSAPP_CLOUD_WABA_ID,
            WHATSAPP_CLOUD_APP_SECRET, WHATSAPP_CLOUD_VERIFY_TOKEN.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Access token {wa.access_token_set ? `(saved ${wa.access_token_hint})` : ''}</Label>
            <Input
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder={wa.access_token_set ? 'Leave blank to keep the saved token' : 'Paste when the Business API is allocated'}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone number ID</Label>
            <Input
              value={phoneNumberId}
              onChange={e => setPhoneNumberId(e.target.value)}
              placeholder="From Meta developer app"
            />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp Business Account ID</Label>
            <Input
              value={wabaId}
              onChange={e => setWabaId(e.target.value)}
              placeholder="Optional WABA ID"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-[#0D9488] hover:bg-[#0B7E73]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save credentials'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 border-border space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Webhook (Meta callback URL)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Point the WhatsApp Business webhook here after the app is created. Delivery receipts update sent/failed in the queue.
          </p>
        </div>
        <div className="flex gap-2">
          <Input readOnly value={wa.webhook_url || '/api/webhooks/whatsapp'} />
          <Button type="button" variant="outline" onClick={() => copy(wa.webhook_url || '/api/webhooks/whatsapp', 'Webhook URL')}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Verify token env: WHATSAPP_CLOUD_VERIFY_TOKEN {wa.verify_token_set ? '(set)' : '(not set yet)'}.
          App secret env: WHATSAPP_CLOUD_APP_SECRET {wa.app_secret_set ? '(set)' : '(not set yet)'}.
        </p>
      </Card>

      <Card className="p-4 border-border space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Templates to create in WhatsApp Manager</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Business-initiated messages (booking, reminders, visit summary) require approved templates with these names.
          </p>
        </div>
        <div className="space-y-2">
          {(wa.templates || []).map(tpl => (
            <div key={tpl.type} className="rounded-md border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono">{tpl.name}</code>
                <span className="text-[10px] text-muted-foreground">{tpl.language}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{tpl.sample_body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
