'use client'
import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle, Clock, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

function App() {
  const [lowStock, setLowStock] = useState([])
  const [expiringSoon, setExpiringSoon] = useState([])
  const [loading, setLoading] = useState(true)
  const [stockInOpen, setStockInOpen] = useState(false)
  const [stockItem, setStockItem] = useState(null)
  const [vendors, setVendors] = useState([])

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/inventory/alerts')
    const d = await r.json()
    setLowStock(d.low_stock || [])
    setExpiringSoon(d.expiring_soon || [])
    setLoading(false)
  }

  const loadVendors = async () => {
    const r = await fetch('/api/vendors?type=supplier')
    const d = await r.json()
    setVendors(d.vendors || [])
  }

  useEffect(() => { load(); loadVendors() }, [])

  const openStockIn = (item) => { setStockItem(item); setStockInOpen(true) }

  const getExpiryBadge = (days) => {
    if (days < 30) return 'bg-red-50 text-red-600 border-red-200'
    if (days < 60) return 'bg-amber-50 text-amber-600 border-amber-200'
    return 'bg-yellow-50 text-yellow-600 border-yellow-200'
  }

  const markExpired = async (item) => {
    if (!confirm(`Mark "${item.item_name}" as expired? This will deduct the current stock.`)) return
    const r = await fetch('/api/inventory/stock-out', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ item_id: item.id, quantity: item.current_stock, reason: 'Expired', notes: 'Marked as expired from alerts' }) 
    })
    const d = await r.json()
    if (r.ok) { toast.success('Item marked as expired'); load() }
    else toast.error(d.error || 'Failed')
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Inventory Alerts</h1>
        <p className="text-muted-foreground text-sm">Low stock and expiry warnings</p>
      </div>

      {loading && <div className="mt-6 flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
      {!loading && (
        <div className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500"/> Low Stock Items ({lowStock.length})
            </h2>
            {lowStock.length === 0 ? (
              <Card className="mt-3 bg-white border-border rounded-lg py-8 text-center text-muted-foreground text-sm">
                No low stock items. Great job!
              </Card>
            ) : (
              <div className="mt-3 bg-white border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Current</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Minimum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Vendor</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map(item => {
                      const vendor = vendors.find(v => v.id === item.vendor_id)
                      return (
                        <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm font-medium">{item.item_name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{item.category}</td>
                          <td className="px-4 py-3 text-sm font-medium text-amber-600">{item.current_stock}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{item.minimum_stock}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{vendor?.name || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" onClick={() => openStockIn(item)} className="bg-[#0D9488] hover:bg-[#0B7E73]">
                              <ArrowUp className="w-3 h-3 mr-1"/> Add Stock
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#0F172A] flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500"/> Expiring Soon ({expiringSoon.length})
            </h2>
            {expiringSoon.length === 0 ? (
              <Card className="mt-3 bg-white border-border rounded-lg py-8 text-center text-muted-foreground text-sm">
                No items expiring soon.
              </Card>
            ) : (
              <div className="mt-3 bg-white border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Batch #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Expiry Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Days Remaining</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringSoon.map(item => (
                      <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm font-medium">{item.item_name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{item.batch_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${getExpiryBadge(item.days_remaining)}`}>
                            {item.days_remaining} days
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => markExpired(item)} className="text-red-600 border-red-200 hover:bg-red-50">
                            Mark Expired
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <StockInDialog open={stockInOpen} setOpen={setStockInOpen} item={stockItem} vendors={vendors} onSaved={load} />
    </div>
  )
}

function StockInDialog({ open, setOpen, item, vendors, onSaved }) {
  const [f, setF] = useState({ quantity: 1, vendor_id: '', purchase_cost: 0, invoice_number: '', notes: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && item) {
      setF({ quantity: 1, vendor_id: item.vendor_id || '', purchase_cost: item.purchase_price || 0, invoice_number: '', notes: '' })
    }
  }, [open, item])

  const submit = async (e) => {
    e.preventDefault()
    if (!f.quantity || f.quantity <= 0) { toast.error('Quantity must be greater than 0'); return }
    setLoading(true)
    const r = await fetch('/api/inventory/stock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: item.id, ...f }) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { toast.success('Stock added successfully'); setOpen(false); onSaved && onSaved() }
    else toast.error(d.error || 'Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Stock In - {item?.item_name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Item</Label><Input value={item?.item_name} disabled className="bg-muted"/></div>
          <div className="space-y-1.5"><Label>Quantity <span className="text-[#EF4444]">*</span></Label><Input type="number" value={f.quantity} onChange={e=>setF({...f,quantity:parseInt(e.target.value)||0})} min="1" autoFocus/></div>
          <div className="space-y-1.5"><Label>Vendor</Label>
            <select value={f.vendor_id} onChange={e=>setF({...f,vendor_id:e.target.value})} className="w-full border border-input rounded-md px-3 py-2 text-sm">
              <option value="">No vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Purchase Cost ₹</Label><Input type="number" value={f.purchase_cost} onChange={e=>setF({...f,purchase_cost:parseFloat(e.target.value)||0})} min="0" step="0.01"/></div>
          <div className="space-y-1.5"><Label>Invoice Number</Label><Input value={f.invoice_number} onChange={e=>setF({...f,invoice_number:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Add Stock'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
