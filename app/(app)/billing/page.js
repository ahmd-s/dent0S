'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Eye, IndianRupee, AlertCircle, Receipt, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const inr = n => '₹' + (n||0).toLocaleString('en-IN')
const fmtDate = d => d ? `${String(new Date(d+'T00:00:00').getDate()).padStart(2,'0')}/${String(new Date(d+'T00:00:00').getMonth()+1).padStart(2,'0')}/${new Date(d+'T00:00:00').getFullYear()}` : '—'
const monthAgo = () => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,10) }
const todayIso = () => new Date().toISOString().slice(0,10)
const statusBadge = s => {
  const m = { pending:'bg-orange-100 text-orange-700', paid:'bg-green-100 text-green-700', partial:'bg-yellow-100 text-yellow-700', waived:'bg-slate-200 text-slate-600' }
  return <span className={`text-xs px-2 py-1 rounded-full capitalize ${m[s]||'bg-slate-100'}`}>{s}</span>
}

function App() {
  const router = useRouter()
  const [list, setList] = useState([])
  const [summary, setSummary] = useState({ collected:0, pending:0, total:0 })
  const [from, setFrom] = useState(monthAgo())
  const [to, setTo] = useState(todayIso())
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [payOpen, setPayOpen] = useState(null)

  const load = async () => {
    const params = new URLSearchParams({ from, to, status })
    if (q) params.set('q', q)
    const r = await fetch('/api/invoices?' + params)
    const d = await r.json()
    setList(d.invoices||[]); setSummary(d.summary||{collected:0,pending:0,total:0})
  }
  useEffect(() => { load() }, [from, to, status, q])

  const exportCsv = () => {
    const rows = [['Invoice #','Date','Patient','Amount','Status','Payment Mode']].concat(list.map(i => [i.invoice_number, i.invoice_date, i.patient_name, i.total_amount, i.payment_status, i.payment_mode||'']))
    const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `invoices-${from}-to-${to}.csv`; a.click()
  }

  const cards = [
    { label:'Collected (last 30d)', val: inr(summary.collected), icon: IndianRupee, color:'#22C55E' },
    { label:'Pending', val: inr(summary.pending), icon: AlertCircle, color:'#F59E0B' },
    { label:'Total Invoiced', val: inr(summary.total), icon: Receipt, color:'#0D9488' },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-3 gap-4">
        {cards.map(c => { const Icon = c.icon; return (
          <Card key={c.label} className="p-5 bg-white border-border rounded-lg">
            <div className="flex items-start justify-between">
              <div><div className="text-sm text-muted-foreground">{c.label}</div><div className="text-3xl font-bold mt-2" style={{color: c.color}}>{c.val}</div></div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: c.color+'15'}}><Icon className="w-5 h-5" style={{color: c.color}}/></div>
            </div>
          </Card>
        )})}
      </div>

      <Card className="mt-5 p-4 bg-white border-border rounded-lg flex items-center gap-3 flex-wrap">
        <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-40"/></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-40"/></div>
        <div className="flex-1 min-w-[180px]"><Label className="text-xs">Search</Label><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Patient name or invoice number…" className="pl-9"/></div></div>
        <div><Label className="text-xs">Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="waived">Waived</SelectItem></SelectContent></Select></div>
        <div className="self-end"><Button variant="outline" onClick={exportCsv}>Export CSV</Button></div>
      </Card>

      <Card className="mt-4 bg-white border-border rounded-lg overflow-hidden">
        {list.length===0 && <div className="py-12 text-center text-muted-foreground text-sm">No invoices in this date range</div>}
        {list.length>0 && (
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-muted-foreground tracking-wider">
              <tr><th className="px-5 py-3 font-medium">Invoice #</th><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Patient</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr>
            </thead>
            <tbody>
              {list.map(i => (
                <tr key={i.id} className="border-t border-border hover:bg-[#F8FAFC]/50">
                  <td className="px-5 py-3 font-mono text-xs">{i.invoice_number}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(i.invoice_date)}</td>
                  <td className="px-5 py-3">{i.patient_name}</td>
                  <td className="px-5 py-3 font-medium">{inr(i.total_amount)}</td>
                  <td className="px-5 py-3">{statusBadge(i.payment_status)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/billing/${i.id}`}><Button size="sm" variant="outline" className="h-8"><Eye className="w-3.5 h-3.5 mr-1"/>View</Button></Link>
                      {(i.payment_status==='pending' || i.payment_status==='partial') && <Button size="sm" onClick={()=>setPayOpen(i)} className="h-8 bg-[#0D9488] hover:bg-[#0B7E73]">Mark Paid</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <MarkPaidModal invoice={payOpen} onClose={()=>setPayOpen(null)} onSaved={load}/>
    </div>
  )
}

function MarkPaidModal({ invoice, onClose, onSaved }) {
  const [mode, setMode] = useState('cash')
  const [busy, setBusy] = useState(false)
  if (!invoice) return null
  const submit = async () => {
    setBusy(true)
    const r = await fetch(`/api/invoices/${invoice.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ payment_status:'paid', payment_mode: mode }) })
    setBusy(false)
    if (r.ok) { toast.success('Marked paid'); onClose(); onSaved && onSaved() } else toast.error('Failed')
  }
  return (
    <Dialog open={!!invoice} onOpenChange={v=>{ if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Mark {invoice.invoice_number} as Paid</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><div className="text-sm text-muted-foreground">Amount</div><div className="text-2xl font-bold">{inr(invoice.total_amount)}</div></div>
          <div className="space-y-1.5"><Label>Payment Mode</Label><Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['cash','upi','card','net_banking'].map(p=><SelectItem key={p} value={p} className="capitalize">{p.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy} className="bg-[#0D9488] hover:bg-[#0B7E73]">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:'Confirm Paid'}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default App
