'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Send, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const AUDIENCES = [
  { value: 'all_patients', label: 'All Patients' },
  { value: 'inactive_patients', label: 'Inactive Patients' },
  { value: 'pending_treatment', label: 'Pending Treatment' },
  { value: 'unpaid_balance', label: 'Unpaid Balance' },
  { value: 'recall', label: 'Recall Campaign' },
  { value: 'birthday', label: 'Birthday Campaign' },
]

export default function CampaignCenter() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', message: '', audience: 'all_patients', subject: '' })

  const load = () => {
    fetch('/api/communication/campaigns')
      .then(r => r.json())
      .then(d => { setCampaigns(d.campaigns || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name || !form.message) return toast.error('Name and message required')
    setCreating(true)
    const r = await fetch('/api/communication/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    setCreating(false)
    if (r.ok) {
      toast.success('Campaign created')
      setForm({ name: '', message: '', audience: 'all_patients', subject: '' })
      load()
    } else toast.error(d.error || 'Failed')
  }

  const send = async (id) => {
    const r = await fetch('/api/communication/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', campaign_id: id }),
    })
    const d = await r.json()
    if (r.ok) {
      toast.success(`Sent to ${d.sent}/${d.total} patients`)
      load()
    } else toast.error(d.error || 'Send failed')
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" /></div>

  return (
    <div className="space-y-4">
      <Card className="p-4 border-border space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" />Create Campaign</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Campaign name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.audience}
            onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
          >
            {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <Input placeholder="Subject (optional)" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
        <Textarea placeholder="Message body — use {{patient_name}} and {{clinic_name}}" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} />
        <Button onClick={create} disabled={creating} className="bg-[#0D9488] hover:bg-[#0D9488]/90">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Campaign'}
        </Button>
      </Card>

      <div className="space-y-2">
        {campaigns.map(c => (
          <Card key={c.id} className="p-4 border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                <Users className="w-3 h-3" />{AUDIENCES.find(a => a.value === c.audience)?.label || c.audience}
                · <span className="capitalize">{c.status}</span>
                {c.sent_count > 0 && ` · ${c.sent_count} sent`}
              </div>
            </div>
            {c.status !== 'sent' && (
              <Button size="sm" variant="outline" onClick={() => send(c.id)}>
                <Send className="w-3 h-3 mr-1" />Send Now
              </Button>
            )}
          </Card>
        ))}
        {!campaigns.length && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
      </div>
    </div>
  )
}
