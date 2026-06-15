'use client'
import { useEffect, useState } from 'react'
import { Loader2, Package, IndianRupee, AlertTriangle, Clock, ArrowUp, ArrowRight, Plus, Settings } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRole } from '@/components/dentos/RoleContext'

function App() {
  const [analytics, setAnalytics] = useState({ 
    total_items: 0, 
    total_value: 0, 
    low_stock_count: 0, 
    expiring_soon_count: 0, 
    total_consumed_this_month: 0,
    cost_consumed_this_month: 0, 
    most_consumed: [], 
    monthly_consumption: [] 
  })
  const [lowStock, setLowStock] = useState([])
  const [expiringSoon, setExpiringSoon] = useState([])
  const [loading, setLoading] = useState(true)
  const [stockInOpen, setStockInOpen] = useState(false)
  const [stockItem, setStockItem] = useState(null)
  const [vendors, setVendors] = useState([])
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [inventoryItems, setInventoryItems] = useState([])
  const [seedingCatalog, setSeedingCatalog] = useState(false)
  const [catalogSeeded, setCatalogSeeded] = useState(false)
  const { isAdmin } = useRole()

  useEffect(() => {
    setCatalogSeeded(localStorage.getItem('master_catalog_seeded') === 'true')
  }, [])

  const seedCatalog = async () => {
    setSeedingCatalog(true)
    try {
      const r = await fetch('/api/seed-master-catalog', { method: 'POST' })
      const d = await r.json()
      if (r.ok) {
        toast.success('Catalog ready — 110+ items loaded')
        localStorage.setItem('master_catalog_seeded', 'true')
        setCatalogSeeded(true)
      } else {
        toast.error(d.error || 'Failed to seed catalog')
      }
    } catch (e) {
      toast.error('Failed to seed catalog')
    } finally {
      setSeedingCatalog(false)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const [analyticsRes, alertsRes] = await Promise.all([
        fetch('/api/inventory/analytics'),
        fetch('/api/inventory/alerts')
      ])
      const analyticsData = await analyticsRes.json()
      const alertsData = await alertsRes.json()
      setAnalytics(analyticsData)
      setLowStock(alertsData.low_stock?.slice(0, 5) || [])
      setExpiringSoon(alertsData.expiring_soon?.slice(0, 5) || [])
    } catch (e) {
      console.error('Error loading dashboard data:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadVendors = async () => {
    const r = await fetch('/api/vendors?type=supplier')
    const d = await r.json()
    setVendors(d.vendors || [])
  }

  const loadInventoryItems = async () => {
    const r = await fetch('/api/inventory')
    const d = await r.json()
    setInventoryItems(d.items || [])
  }

  useEffect(() => { load(); loadVendors(); loadInventoryItems() }, [])

  const openStockIn = (item) => { setStockItem(item); setStockInOpen(true) }

  const getExpiryBadge = (days) => {
    if (days < 30) return 'bg-red-50 text-red-600 border-red-200'
    if (days < 60) return 'bg-amber-50 text-amber-600 border-amber-200'
    return 'bg-yellow-50 text-yellow-600 border-yellow-200'
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Inventory Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your dental materials and supplies</p>
        </div>
        <div className="flex items-center gap-2">
          {!catalogSeeded && isAdmin() && (
            <Button 
              onClick={seedCatalog} 
              disabled={seedingCatalog}
              variant="outline"
              className="border-[#0D9488] text-[#0D9488] hover:bg-[#0D9488]/10"
            >
              {seedingCatalog ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Settings className="w-4 h-4 mr-1"/>}
              Setup Catalog
            </Button>
          )}
          <Button onClick={() => setQuickAddOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73]">
            <Plus className="w-4 h-4 mr-1"/>Add Stock
          </Button>
        </div>
      </div>

      {loading && <div className="mt-6 flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
      {!loading && analytics && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-white border-border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold text-[#0F172A]">{analytics.total_items}</p>
                </div>
                <Package className="w-8 h-8 text-[#0D9488]"/>
              </div>
            </Card>
            <Card className="p-5 bg-white border-border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold text-[#0F172A]">₹{analytics.total_value.toLocaleString()}</p>
                </div>
                <IndianRupee className="w-8 h-8 text-[#0D9488]"/>
              </div>
            </Card>
            <Card className={`p-5 bg-white border-border rounded-lg ${analytics.low_stock_count > 0 ? 'border-amber-300' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className={`text-2xl font-bold ${analytics.low_stock_count > 0 ? 'text-amber-600' : 'text-[#0F172A]'}`}>{analytics.low_stock_count}</p>
                </div>
                <AlertTriangle className={`w-8 h-8 ${analytics.low_stock_count > 0 ? 'text-amber-500' : 'text-[#0D9488]'}`}/>
              </div>
            </Card>
            <Card className={`p-5 bg-white border-border rounded-lg ${analytics.expiring_soon_count > 0 ? 'border-orange-300' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                  <p className={`text-2xl font-bold ${analytics.expiring_soon_count > 0 ? 'text-orange-600' : 'text-[#0F172A]'}`}>{analytics.expiring_soon_count}</p>
                </div>
                <Clock className={`w-8 h-8 ${analytics.expiring_soon_count > 0 ? 'text-orange-500' : 'text-[#0D9488]'}`}/>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 bg-white border-border rounded-lg">
              <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500"/> Low Stock Items
              </h2>
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No low stock items</p>
              ) : (
                <div className="space-y-3">
                  {lowStock.map(item => {
                    const vendor = vendors.find(v => v.id === item.vendor_id)
                    return (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">{vendor?.name || 'No vendor'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-amber-600">{item.current_stock} / {item.minimum_stock}</p>
                          </div>
                          <Button size="sm" onClick={() => openStockIn(item)} className="bg-[#0D9488] hover:bg-[#0B7E73]">
                            <ArrowUp className="w-3 h-3"/>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => window.location.href = '/inventory/alerts'}>
                    View All <ArrowRight className="w-4 h-4 ml-1"/>
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-5 bg-white border-border rounded-lg">
              <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500"/> Expiring Soon
              </h2>
              {expiringSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No items expiring soon</p>
              ) : (
                <div className="space-y-3">
                  {expiringSoon.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '-'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getExpiryBadge(item.days_remaining)}`}>
                        {item.days_remaining} days
                      </span>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => window.location.href = '/inventory/alerts'}>
                    View All <ArrowRight className="w-4 h-4 ml-1"/>
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-5 bg-white border-border rounded-lg">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Monthly Consumption</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthly_consumption}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="month" tick={{fontSize: 12}}/>
                  <YAxis tick={{fontSize: 12}}/>
                  <Tooltip />
                  <Bar dataKey="total_out" fill="#0D9488" radius={[4, 4, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <StockInDialog open={stockInOpen} setOpen={setStockInOpen} item={stockItem} vendors={vendors} onSaved={load} />
      <QuickAddStockDialog open={quickAddOpen} setOpen={setQuickAddOpen} inventoryItems={inventoryItems} vendors={vendors} onSaved={load} />
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

function QuickAddStockDialog({ open, setOpen, inventoryItems, vendors, onSaved }) {
  const [f, setF] = useState({ item_id: '', quantity: 1, vendor_id: '', purchase_cost: 0, invoice_number: '', notes: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setF({ item_id: '', quantity: 1, vendor_id: '', purchase_cost: 0, invoice_number: '', notes: '' })
    }
  }, [open])

  const selectedItem = inventoryItems.find(i => i.id === f.item_id)

  useEffect(() => {
    if (selectedItem) {
      setF(prev => ({ ...prev, vendor_id: selectedItem.vendor_id || '', purchase_cost: selectedItem.purchase_price || 0 }))
    }
  }, [selectedItem])

  const submit = async (e) => {
    e.preventDefault()
    if (!f.item_id) { toast.error('Please select an item'); return }
    if (!f.quantity || f.quantity <= 0) { toast.error('Quantity must be greater than 0'); return }
    setLoading(true)
    const r = await fetch('/api/inventory/stock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: f.item_id, ...f }) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { toast.success('Stock added successfully'); setOpen(false); onSaved && onSaved() }
    else toast.error(d.error || 'Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Stock</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Item <span className="text-[#EF4444]">*</span></Label>
            <Select value={f.item_id} onValueChange={v=>setF({...f,item_id:v})}>
              <SelectTrigger><SelectValue placeholder="Select item"/></SelectTrigger>
              <SelectContent>
                {inventoryItems.map(i => <SelectItem key={i.id} value={i.id}>{i.item_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Quantity <span className="text-[#EF4444]">*</span></Label><Input type="number" value={f.quantity} onChange={e=>setF({...f,quantity:parseInt(e.target.value)||0})} min="1" disabled={!f.item_id}/></div>
          <div className="space-y-1.5"><Label>Vendor</Label>
            <Select value={f.vendor_id || 'none'} onValueChange={v=>setF({...f,vendor_id:v === 'none' ? '' : v})} disabled={!f.item_id}>
              <SelectTrigger><SelectValue placeholder="Select vendor"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vendor</SelectItem>
                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Purchase Cost ₹</Label><Input type="number" value={f.purchase_cost} onChange={e=>setF({...f,purchase_cost:parseFloat(e.target.value)||0})} min="0" step="0.01" disabled={!f.item_id}/></div>
          <div className="space-y-1.5"><Label>Invoice Number</Label><Input value={f.invoice_number} onChange={e=>setF({...f,invoice_number:e.target.value})} disabled={!f.item_id}/></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} disabled={!f.item_id}/></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !f.item_id} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Add Stock'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
