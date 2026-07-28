'use client'
import { useEffect, useState } from 'react'
import { Plus, Phone, Search, X, Loader2, Edit2, Trash2, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'

const EMPTY = { name: '', contact_person: '', phone: '', email: '', material_types: '', address: '', notes: '', vendor_type: 'both' }

function App() {
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const { canManageInventory } = useRole()
  const canManage = canManageInventory()

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const r = await fetch('/api/vendors?' + params)
    const d = await r.json()
    setList(d.vendors || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [q])

  const openNew = () => { setEditing(null); setOpen(true) }
  const openEdit = (v) => { setEditing(v); setOpen(true) }

  const del = async (v) => {
    if (!confirm(`Delete vendor "${v.name}"?`)) return
    const r = await fetch(`/api/vendors/${v.id}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) { toast.success('Vendor deleted'); load() }
    else toast.error(d.error || 'Failed to delete vendor')
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><p className="text-muted-foreground text-sm">Manage dental labs &amp; suppliers</p></div>
        {canManage && <Button onClick={openNew} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Vendor</Button>}
      </div>
      <Card className="mt-5 p-4 bg-card border-border rounded-lg flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search labs by name, contact or phone…" className="pl-9"/>
          {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground"/></button>}
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">{list.length} vendors</span>
      </Card>

      {loading && <div className="mt-6 flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
      {!loading && list.length === 0 && (
        <Card className="mt-4 bg-card border-border rounded-lg py-16 text-center text-muted-foreground text-sm">
          No vendors yet. {!canManage && 'Add your first dental lab to start tracking cases.'}
        </Card>
      )}
      {!loading && list.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(v => (
            <Card key={v.id} className="p-5 bg-card border-border rounded-lg flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{v.name}</div>
                  {v.material_types && <div className="text-xs text-muted-foreground mt-0.5 truncate">{v.material_types}</div>}
                  {v.vendor_type === 'dental_lab' && (
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 mt-1 inline-block">Dental Lab</span>
                  )}
                  {v.vendor_type === 'supplier' && (
                    <span className="text-xs bg-green-50 text-green-600 border border-green-200 rounded-full px-2 py-0.5 mt-1 inline-block">Material Supplier</span>
                  )}
                  {(v.vendor_type === 'both' || !v.vendor_type) && (
                    <span className="text-xs bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5 mt-1 inline-block">Lab & Supplier</span>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={()=>openEdit(v)} className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center" aria-label="Edit"><Edit2 className="w-3.5 h-3.5 text-muted-foreground"/></button>
                    <button onClick={()=>del(v)} className="w-7 h-7 rounded hover:bg-red-50 flex items-center justify-center" aria-label="Delete"><Trash2 className="w-3.5 h-3.5 text-red-500"/></button>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                {v.contact_person && <div className="flex items-center gap-2 text-muted-foreground"><User className="w-3.5 h-3.5"/>{v.contact_person}</div>}
                {v.phone
                  ? <a href={`tel:${v.phone}`} className="flex items-center gap-2 text-[#0D9488] hover:underline font-medium"><Phone className="w-3.5 h-3.5"/>{v.phone}</a>
                  : <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5"/>No phone</div>}
                {v.email && <a href={`mailto:${v.email}`} className="flex items-center gap-2 text-muted-foreground hover:underline"><Mail className="w-3.5 h-3.5"/>{v.email}</a>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <VendorDialog open={open} setOpen={setOpen} editing={editing} onSaved={load} />
    </div>
  )
}

function VendorDialog({ open, setOpen, editing, onSaved }) {
  const [f, setF] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setF(editing ? {
      name: editing.name || '', contact_person: editing.contact_person || '', phone: editing.phone || '',
      email: editing.email || '', material_types: editing.material_types || '', address: editing.address || '', notes: editing.notes || '',
      vendor_type: editing.vendor_type || 'both',
    } : EMPTY)
  }, [open, editing])

  const submit = async (e) => {
    e.preventDefault()
    if (!f.name.trim()) { toast.error('Vendor name is required'); return }
    if (f.phone && !/^\d{7,15}$/.test(f.phone)) { toast.error('Phone must be 7-15 digits'); return }
    setLoading(true)
    const url = editing ? `/api/vendors/${editing.id}` : '/api/vendors'
    const method = editing ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { toast.success(editing ? 'Vendor updated' : 'Vendor added'); setOpen(false); onSaved && onSaved() }
    else toast.error(d.error || 'Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2"><Label>Lab / Vendor Name <span className="text-[#EF4444]">*</span></Label><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. XYZ Dental Lab" autoFocus/></div>
          <div className="space-y-1.5 col-span-2">
            <Label>Vendor Type</Label>
            <select 
              value={f.vendor_type} 
              onChange={e => setF({...f, vendor_type: e.target.value})}
              className="w-full border border-input rounded-md px-3 py-2 text-sm"
            >
              <option value="both">Dental Lab & Material Supplier</option>
              <option value="dental_lab">Dental Lab only (Lab Cases)</option>
              <option value="supplier">Material Supplier only (Inventory)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Dental Labs appear in Lab Cases. Material Suppliers appear in Inventory stock management.
            </p>
          </div>
          <div className="space-y-1.5"><Label>Contact Person</Label><Input value={f.contact_person} onChange={e=>setF({...f,contact_person:e.target.value})} placeholder="e.g. Rahul Sharma"/></div>
          <div className="space-y-1.5"><Label>Phone Number</Label><Input value={f.phone} onChange={e=>setF({...f,phone:e.target.value.replace(/\D/g,'').slice(0,15)})} placeholder="9876543210"/></div>
          <div className="space-y-1.5 col-span-2"><Label>Email</Label><Input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="lab@example.com"/></div>
          <div className="space-y-1.5 col-span-2"><Label>Material Types / Specialties</Label><Input value={f.material_types} onChange={e=>setF({...f,material_types:e.target.value})} placeholder="e.g. Zirconia, PFM, Dentures"/></div>
          <div className="space-y-1.5 col-span-2"><Label>Address</Label><Textarea rows={2} value={f.address} onChange={e=>setF({...f,address:e.target.value})}/></div>
          <div className="space-y-1.5 col-span-2"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:(editing?'Save Changes':'Save Vendor')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
