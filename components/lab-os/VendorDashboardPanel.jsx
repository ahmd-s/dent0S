'use client'

import { useEffect, useState } from 'react'
import { Loader2, Phone, Mail, MapPin, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function VendorDashboardPanel({ vendorId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!vendorId) return
    setLoading(true)
    fetch(`/api/vendors/${vendorId}/dashboard`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [vendorId])

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#0D9488]" /></div>
  if (!data?.vendor) return null

  const v = data.vendor

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{v.name}</h3>
          {v.contact_person && <p className="text-sm text-muted-foreground">{v.contact_person}</p>}
        </div>
        {v.rating && (
          <span className="flex items-center gap-1 text-sm text-amber-600"><Star className="w-4 h-4 fill-amber-400" />{v.rating}</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Metric label="Active" value={v.active_cases} />
        <Metric label="Completed" value={v.completed_cases} />
        <Metric label="Delayed" value={v.delayed_cases} color={v.delayed_cases > 0 ? '#EF4444' : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><ClockIcon /> Today: {data.today_workload} cases</div>
        <div className="flex items-center gap-1.5"><ClockIcon /> Pending: {data.pending_deliveries}</div>
        <div>Avg turnaround: {v.average_turnaround != null ? `${v.average_turnaround}d` : '—'}</div>
        {v.services && <div className="col-span-2">Services: {v.services}</div>}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {v.phone && <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-[#0D9488] hover:underline"><Phone className="w-3 h-3" />{v.phone}</a>}
        {v.email && <a href={`mailto:${v.email}`} className="flex items-center gap-1 text-[#0D9488] hover:underline"><Mail className="w-3 h-3" />{v.email}</a>}
        {v.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.address}</span>}
      </div>

      <Link href={`/vendors`} className="text-xs text-[#0D9488] hover:underline">View all vendors →</Link>
    </Card>
  )
}

function Metric({ label, value, color }) {
  return (
    <div className="p-2 rounded-lg bg-muted/50">
      <div className="text-lg font-bold tabular-nums" style={{ color: color || 'inherit' }}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function ClockIcon() {
  return <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeWidth="2" d="M12 6v6l4 2"/></svg>
}
