'use client'
import { useEffect, useState } from 'react'
import { Plus, Loader2, Edit2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useRole } from '@/components/dentos/RoleContext'

function App() {
  const [templates, setTemplates] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const { isReceptionist } = useRole()
  const receptionist = isReceptionist()

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/inventory/templates')
    const d = await r.json()
    setTemplates(d.templates || [])
    setLoading(false)
  }

  const loadItems = async () => {
    const r = await fetch('/api/inventory')
    const d = await r.json()
    setItems(d.items || [])
  }

  useEffect(() => { load(); loadItems() }, [])

  const openNew = () => { setEditing(null); setOpen(true) }
  const openEdit = (template) => { setEditing(template); setOpen(true) }

  const del = async (template) => {
    if (!confirm(`Delete template "${template.treatment_name}"?`)) return
    const r = await fetch(`/api/inventory/templates/${template.id}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) { toast.success('Template deleted'); load() }
    else toast.error(d.error || 'Failed to delete template')
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Treatment Templates</h1>
          <p className="text-muted-foreground text-sm">Define suggested material consumption per treatment</p>
        </div>
        {!receptionist && <Button onClick={openNew} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Template</Button>}
      </div>

      {loading && <div className="mt-6 flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
      {!loading && templates.length === 0 && (
        <Card className="mt-4 bg-white border-border rounded-lg py-16 text-center text-muted-foreground text-sm">
          No treatment templates yet. {!receptionist && 'Create your first template to streamline inventory consumption.'}
        </Card>
      )}
      {!loading && templates.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <Card key={template.id} className="p-5 bg-white border-border rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-[#0F172A]">{template.treatment_name}</h3>
                {!receptionist && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(template)} className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center" title="Edit"><Edit2 className="w-3.5 h-3.5 text-muted-foreground"/></button>
                    <button onClick={() => del(template)} className="w-7 h-7 rounded hover:bg-red-50 flex items-center justify-center" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-500"/></button>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {template.items.map((item, idx) => (
                  <div key={idx} className="text-sm text-muted-foreground flex justify-between">
                    <span>{item.item_name}</span>
                    <span className="font-medium">{item.suggested_quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <TemplateDialog open={open} setOpen={setOpen} editing={editing} items={items} onSaved={load} />
    </div>
  )
}

function TemplateDialog({ open, setOpen, editing, items, onSaved }) {
  const [f, setF] = useState({ treatment_name: '', items: [{ item_id: '', item_name: '', suggested_quantity: 1, unit: '' }] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setF(editing ? { ...editing } : { treatment_name: '', items: [{ item_id: '', item_name: '', suggested_quantity: 1, unit: '' }] })
    }
  }, [open, editing])

  const addItem = () => {
    setF({ ...f, items: [...f.items, { item_id: '', item_name: '', suggested_quantity: 1, unit: '' }] })
  }

  const removeItem = (idx) => {
    setF({ ...f, items: f.items.filter((_, i) => i !== idx) })
  }

  const updateItem = (idx, field, value) => {
    const newItems = [...f.items]
    newItems[idx][field] = value
    if (field === 'item_id') {
      const item = items.find(i => i.id === value)
      newItems[idx].item_name = item?.item_name || ''
      newItems[idx].unit = item?.unit || ''
    }
    setF({ ...f, items: newItems })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!f.treatment_name.trim()) { toast.error('Treatment name is required'); return }
    if (!f.items || f.items.length === 0) { toast.error('At least one item is required'); return }
    for (const item of f.items) {
      if (!item.item_id) { toast.error('Please select an item for all rows'); return }
      if (!item.suggested_quantity || item.suggested_quantity <= 0) { toast.error('Suggested quantity must be greater than 0'); return }
    }
    setLoading(true)
    const url = editing ? `/api/inventory/templates/${editing.id}` : '/api/inventory/templates'
    const method = editing ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const d = await r.json()
    setLoading(false)
    if (r.ok) { toast.success(editing ? 'Template updated' : 'Template added'); setOpen(false); onSaved && onSaved() }
    else toast.error(d.error || 'Failed')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit Template' : 'Add New Template'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Treatment Name <span className="text-[#EF4444]">*</span></Label><Input value={f.treatment_name} onChange={e=>setF({...f,treatment_name:e.target.value})} placeholder="e.g. Composite Filling" autoFocus/></div>
          
          <div className="space-y-2">
            <Label>Materials</Label>
            {f.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select 
                  value={item.item_id} 
                  onChange={e => updateItem(idx, 'item_id', e.target.value)}
                  className="flex-1 border border-input rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select material</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                </select>
                <Input 
                  type="number" 
                  value={item.suggested_quantity} 
                  onChange={e => updateItem(idx, 'suggested_quantity', parseInt(e.target.value) || 0)}
                  placeholder="Qty" 
                  className="w-20"
                  min="1"
                />
                <span className="text-sm text-muted-foreground w-12">{item.unit}</span>
                {f.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="w-7 h-7 rounded hover:bg-red-50 flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-red-500"/>
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">+ Add Material</Button>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#0D9488] hover:bg-[#0B7E73]">{loading?<Loader2 className="w-4 h-4 animate-spin"/>:(editing?'Save Changes':'Save Template')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
