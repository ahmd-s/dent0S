'use client'
import { useCallback, useEffect, useState } from 'react'
import { Search, Loader2, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/dentos/EmptyState'

function App() {
  const [movements, setMovements] = useState([])
  const [q, setQ] = useState('')
  const [movementType, setMovementType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('item_id', q)
    if (movementType) params.set('movement_type', movementType)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    params.set('page', page)
    params.set('page_size', '20')
    const r = await fetch('/api/inventory/movements?' + params)
    const d = await r.json()
    setMovements(d.movements || [])
    setPagination(d.pagination)
    setLoading(false)
  }, [q, movementType, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])

  const getMovementTypeBadge = (type) => {
    const badges = {
      'STOCK_IN': 'bg-green-50 text-green-600 border-green-200',
      'STOCK_OUT': 'bg-red-50 text-red-600 border-red-200',
      'MANUAL_ADJUSTMENT': 'bg-blue-50 text-blue-600 border-blue-200',
      'AUTO_CONSUMPTION': 'bg-purple-50 text-purple-600 border-purple-200'
    }
    return badges[type] || 'bg-gray-50 text-gray-600 border-gray-200'
  }

  const formatDate = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Stock Movement History</h1>
        <p className="text-muted-foreground text-sm">Track all stock in, stock out, and adjustments</p>
      </div>
      
      <Card className="mt-5 p-4 bg-card border-border rounded-lg flex items-center gap-3 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search item name..." className="pl-9"/>
        </div>
        <select value={movementType} onChange={e=>setMovementType(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm">
          <option value="">All Types</option>
          <option value="STOCK_IN">Stock In</option>
          <option value="STOCK_OUT">Stock Out</option>
          <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
          <option value="AUTO_CONSUMPTION">Auto Consumption</option>
        </select>
        <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-auto"/>
        <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-auto"/>
      </Card>

      {loading && <div className="mt-6 flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
      {!loading && movements.length === 0 && (
        <EmptyState
          icon={Search}
          title="No movements found"
          description="Stock in, stock out, and consumption appear here as they happen."
        />
      )}
      {!loading && movements.length > 0 && (
        <div className="mt-4 bg-card border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Date & Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Item Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Direction</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Stock Before → After</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Done By</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(m.created_at)}</td>
                  <td className="px-4 py-3 text-sm font-medium">{m.item_name}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${getMovementTypeBadge(m.movement_type)}`}>{m.movement_type.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-sm font-medium">{m.quantity}</td>
                  <td className="px-4 py-3">
                    {m.direction === 'in' ? <ArrowUp className="w-4 h-4 text-green-600"/> : <ArrowDown className="w-4 h-4 text-red-600"/>}
                  </td>
                  <td className="px-4 py-3 text-sm">{m.stock_before} → {m.stock_after}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{m.reason}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{m.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!pagination.has_prev}>
            <ChevronLeft className="w-4 h-4"/> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.total_pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!pagination.has_next}>
            Next <ChevronRight className="w-4 h-4"/>
          </Button>
        </div>
      )}
    </div>
  )
}

export default App
