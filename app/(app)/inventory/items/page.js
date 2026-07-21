'use client'
import { Component } from 'react'
import { useEffect, useState } from 'react'
import { Plus, Search, X, Loader2, Edit2, ArrowUp, ArrowDown, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500">
          <h2>Error loading inventory items</h2>
          <pre className="text-xs mt-2">{this.state.error?.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

const CATEGORIES = ['Restorative', 'Endodontic', 'Orthodontic', 'Surgical', 'Consumables', 'PPE', 'Lab Materials', 'Impression Materials', 'Miscellaneous']
const UNITS = ['piece', 'box', 'packet', 'bottle', 'syringe', 'ml', 'gram']

const EMPTY = { item_name: '', category: '', unit: '', minimum_stock: 5, purchase_price: 0, vendor_id: '', batch_number: '', expiry_date: '', description: '' }

function App() {
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [stockInOpen, setStockInOpen] = useState(false)
  const [stockOutOpen, setStockOutOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [stockItem, setStockItem] = useState(null)
  const { canManageInventory } = useRole()

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (category) params.set('category', category)
    if (lowStockOnly) params.set('low_stock', 'true')
    const r = await fetch('/api/inventory?' + params)
    const d = await r.json()
    setItems(d.items || [])
    setLoading(false)
  }

  const loadVendors = async () => {
    const r = await fetch('/api/vendors?type=supplier')
    const d = await r.json()
    setVendors(d.vendors || [])
  }

  useEffect(() => { load(); loadVendors() }, [q, category, lowStockOnly])

  const openNew = () => { setEditing(null); setOpen(true) }
  const openEdit = (item) => { setEditing(item); setOpen(true) }
  const openStockIn = (item) => { setStockItem(item); setStockInOpen(true) }
  const openStockOut = (item) => { setStockItem(item); setStockOutOpen(true) }

  const getStatus = (item) => {
    if (item.current_stock === 0) return { label: 'Out of Stock', color: 'bg-red-50 text-red-600 border-red-200' }
    if (item.current_stock <= item.minimum_stock) return { label: 'Low Stock', color: 'bg-amber-50 text-amber-600 border-amber-200' }
    return { label: 'In Stock', color: 'bg-green-50 text-green-600 border-green-200' }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Items</h1>
          <p className="text-muted-foreground text-sm">Manage dental materials and supplies</p>
        </div>
        {canManageInventory() && <Button onClick={openNew} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Item</Button>}
      </div>
      
      <Card className="mt-5 p-4 bg-card border-border rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name..." className="pl-9"/>
          {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground"/></button>}
        </div>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="border border-input rounded-md px-3 py-2 text-sm w-full sm:w-auto">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowStockOnly} onChange={e=>setLowStockOnly(e.target.checked)} className="rounded"/>
          Low Stock Only
        </label>
        <span className="text-sm text-muted-foreground whitespace-nowrap">{items.length} items</span>
      </Card>

      {loading && <div className="mt-6 flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
      {!loading && items.length === 0 && (
        <Card className="mt-4 bg-card border-border rounded-lg py-16 text-center text-muted-foreground text-sm">
          No inventory items yet. {canManageInventory() && 'Add your first item to start tracking stock.'}
        </Card>
      )}
      {!loading && items.length > 0 && (
        <div className="mt-4 bg-card border-border rounded-lg overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Item Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Current Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Min Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Vendor</th>
                  {canManageInventory() && <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const status = getStatus(item)
                  const vendor = vendors.find(v => v.id === item.vendor_id)
                  return (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => canManageInventory() && openEdit(item)}>
                      <td className="px-4 py-3 text-sm font-medium">{item.item_name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.category}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.unit}</td>
                      <td className="px-4 py-3 text-sm font-medium">{item.current_stock}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.minimum_stock}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${status.color}`}>{status.label}</span></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{vendor?.name || '-'}</td>
                      {canManageInventory() && (
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openStockIn(item)} className="w-8 h-8 rounded hover:bg-green-50 flex items-center justify-center" title="Stock In"><ArrowUp className="w-3.5 h-3.5 text-green-600"/></button>
                            <button onClick={() => openStockOut(item)} className="w-8 h-8 rounded hover:bg-red-50 flex items-center justify-center" title="Stock Out"><ArrowDown className="w-3.5 h-3.5 text-red-600"/></button>
                            <button onClick={() => openEdit(item)} className="w-8 h-8 rounded hover:bg-muted flex items-center justify-center" title="Edit"><Edit2 className="w-3.5 h-3.5 text-muted-foreground"/></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 p-4">
            {items.map(item => {
              const status = getStatus(item)
              const vendor = vendors.find(v => v.id === item.vendor_id)
              return (
                <div key={item.id} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.item_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{item.category}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${status.color} flex-shrink-0 ml-2`}>{status.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div><span className="text-muted-foreground">Stock:</span> {item.current_stock} {item.unit}</div>
                    <div><span className="text-muted-foreground">Min:</span> {item.minimum_stock}</div>
                    <div><span className="text-muted-foreground">Vendor:</span> {vendor?.name||'—'}</div>
                    <div><span className="text-muted-foreground">Unit:</span> {item.unit}</div>
                  </div>
                  {canManageInventory() && (
                    <div className="flex gap-2">
                      <button onClick={() => openStockIn(item)} className="flex-1 h-10 rounded bg-green-50 text-green-600 flex items-center justify-center gap-1 text-xs font-medium"><ArrowUp className="w-3.5 h-3.5"/>Stock In</button>
                      <button onClick={() => openStockOut(item)} className="flex-1 h-10 rounded bg-red-50 text-red-600 flex items-center justify-center gap-1 text-xs font-medium"><ArrowDown className="w-3.5 h-3.5"/>Stock Out</button>
                      <button onClick={() => openEdit(item)} className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Edit2 className="w-3.5 h-3.5"/></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ItemDialog open={open} setOpen={setOpen} editing={editing} vendors={vendors} onSaved={load} />
      <StockInDialog open={stockInOpen} setOpen={setStockInOpen} item={stockItem} vendors={vendors} onSaved={load} />
      <StockOutDialog open={stockOutOpen} setOpen={setStockOutOpen} item={stockItem} onSaved={load} />
    </div>
  )
}

function ItemDialog({ open, setOpen, editing, vendors, onSaved }) {
  const [f, setF] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogResults, setCatalogResults] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false)
  const [fromCatalog, setFromCatalog] = useState(false)
  const searchRef = { current: null }

  useEffect(() => {
    if (open) setF(editing ? { ...editing } : EMPTY)
  }, [open, editing])

  useEffect(() => {
    const searchCatalog = async () => {
      if (catalogSearch.length < 2) {
        setCatalogResults([])
        return
      }
      setCatalogLoading(true)
      try {
        const r = await fetch(`/api/catalog/items?q=${encodeURIComponent(catalogSearch)}`)
        const d = await r.json()
        setCatalogResults(d.items || [])
      } catch (e) {
        setCatalogResults([])
      } finally {
        setCatalogLoading(false)
      }
    }
    const debounce = setTimeout(searchCatalog, 300)
    return () => clearTimeout(debounce)
  }, [catalogSearch])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowCatalogDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectCatalogItem = (item) => {
    setF({ ...f, item_name: item.item_name, category: item.category, unit: item.unit })
    setCatalogSearch(item.item_name)
    setShowCatalogDropdown(false)
    setFromCatalog(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!f.item_name.trim()) { toast.error('Item name is required'); return }
    if (!f.category) { toast.error('Category is required'); return }
    if (!f.unit) { toast.error('Unit is required'); return }
    if (f.minimum_stock < 0) { toast.error('Minimum stock must be >= 0'); return }
    setLoading(true)
    const url = editing ? `/api/inventory/${editing.id}` : '/api/inventory'
    const method = editing ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { toast.success(editing ? 'Item updated' : 'Item added'); setOpen(false); onSaved && onSaved() }
    else toast.error(d.error || 'Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit Item' : 'Add New Item'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2" ref={searchRef}>
            <Label>Item Name <span className="text-[#EF4444]">*</span></Label>
            <div className="relative">
              <Input 
                value={catalogSearch || f.item_name} 
                onChange={e => { setCatalogSearch(e.target.value); setF({...f, item_name: e.target.value}); setFromCatalog(false) }}
                onFocus={() => setShowCatalogDropdown(true)}
                placeholder="e.g. Composite Syringe A2" 
                autoFocus
              />
              {fromCatalog && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-[#0D9488] text-white px-2 py-0.5 rounded">from catalog</span>
              )}
              {showCatalogDropdown && catalogSearch.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {catalogLoading ? (
                    <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin"/>Searching...
                    </div>
                  ) : catalogResults.length > 0 ? (
                    catalogResults.slice(0, 8).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectCatalogItem(item)}
                        className="w-full px-3 py-2 text-left hover:bg-muted border-b border-border last:border-0 flex items-center justify-between"
                      >
                        <span className="text-sm">{item.item_name}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{item.category}</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">No matches — you can still add custom item</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1.5"><Label>Category <span className="text-[#EF4444]">*</span></Label>
            <select value={f.category} onChange={e=>setF({...f,category:e.target.value})} className="w-full border border-input rounded-md px-3 py-2 text-sm">
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Unit <span className="text-[#EF4444]">*</span></Label>
            <select value={f.unit} onChange={e=>setF({...f,unit:e.target.value})} className="w-full border border-input rounded-md px-3 py-2 text-sm">
              <option value="">Select unit</option>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Minimum Stock <span className="text-[#EF4444]">*</span></Label><Input type="number" value={f.minimum_stock} onChange={e=>setF({...f,minimum_stock:parseInt(e.target.value)||0})} min="0"/></div>
          <div className="space-y-1.5"><Label>Purchase Price ₹</Label><Input type="number" value={f.purchase_price} onChange={e=>setF({...f,purchase_price:parseFloat(e.target.value)||0})} min="0" step="0.01"/></div>
          <div className="space-y-1.5 col-span-2"><Label>Preferred Vendor</Label>
            <select value={f.vendor_id} onChange={e=>setF({...f,vendor_id:e.target.value})} className="w-full border border-input rounded-md px-3 py-2 text-sm">
              <option value="">No vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Batch Number</Label><Input value={f.batch_number} onChange={e=>setF({...f,batch_number:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>Expiry Date</Label><Input type="date" value={f.expiry_date} onChange={e=>setF({...f,expiry_date:e.target.value})}/></div>
          <div className="space-y-1.5 col-span-2"><Label>Description</Label><Textarea rows={2} value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:(editing?'Save Changes':'Save Item')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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

function StockOutDialog({ open, setOpen, item, onSaved }) {
  const [f, setF] = useState({ quantity: 1, reason: 'Treatment Consumption', notes: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && item) {
      setF({ quantity: 1, reason: 'Treatment Consumption', notes: '' })
    }
  }, [open, item])

  const submit = async (e) => {
    e.preventDefault()
    if (!f.quantity || f.quantity <= 0) { toast.error('Quantity must be greater than 0'); return }
    if (f.quantity > item.current_stock) { toast.error(`Insufficient stock. Current: ${item.current_stock}`); return }
    if (!f.reason) { toast.error('Reason is required'); return }
    setLoading(true)
    const r = await fetch('/api/inventory/stock-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: item.id, ...f }) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { toast.success('Stock deducted successfully'); setOpen(false); onSaved && onSaved() }
    else toast.error(d.error || 'Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Stock Out - {item?.item_name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Item</Label><Input value={item?.item_name} disabled className="bg-muted"/></div>
          <div className="space-y-1.5"><Label>Current Stock</Label><Input value={item?.current_stock} disabled className="bg-muted"/></div>
          <div className="space-y-1.5"><Label>Quantity <span className="text-[#EF4444]">*</span></Label><Input type="number" value={f.quantity} onChange={e=>setF({...f,quantity:parseInt(e.target.value)||0})} min="1" max={item?.current_stock} autoFocus/></div>
          <div className="space-y-1.5"><Label>Reason <span className="text-[#EF4444]">*</span></Label>
            <select value={f.reason} onChange={e=>setF({...f,reason:e.target.value})} className="w-full border border-input rounded-md px-3 py-2 text-sm">
              <option value="Treatment Consumption">Treatment Consumption</option>
              <option value="Damage">Damage</option>
              <option value="Expired">Expired</option>
              <option value="Transfer">Transfer</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Deduct Stock'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function InventoryItemsPage() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
