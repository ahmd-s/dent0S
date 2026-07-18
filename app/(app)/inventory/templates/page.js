'use client'
import { Component } from 'react'
import { useEffect, useState } from 'react'
import { Plus, Loader2, Edit2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
          <h2>Error loading treatment templates</h2>
          <pre className="text-xs mt-2">{this.state.error?.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const [templates, setTemplates] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const { canManageInventory, loading: roleLoading } = useRole()

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
          <h1 className="text-2xl font-bold text-foreground">Treatment Templates</h1>
          <p className="text-muted-foreground text-sm">Define suggested material consumption per treatment</p>
        </div>
        {!roleLoading && canManageInventory() && <Button onClick={openNew} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Template</Button>}
      </div>

      {loading && <div className="mt-6 flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>}
      {!loading && templates.length === 0 && (
        <Card className="mt-4 bg-card border-border rounded-lg py-16 text-center text-muted-foreground text-sm">
          No treatment templates yet. {!roleLoading && canManageInventory() && 'Create your first template to streamline inventory consumption.'}
        </Card>
      )}
      {!loading && templates.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <Card key={template.id} className="p-5 bg-card border-border rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground">{template.treatment_name}</h3>
                {!roleLoading && canManageInventory() && (
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
  const [treatmentSearch, setTreatmentSearch] = useState('')
  const [treatmentResults, setTreatmentResults] = useState([])
  const [treatmentLoading, setTreatmentLoading] = useState(false)
  const [showTreatmentDropdown, setShowTreatmentDropdown] = useState(false)
  const [fromTreatmentTemplate, setFromTreatmentTemplate] = useState(false)
  const treatmentSearchRef = { current: null }

  useEffect(() => {
    if (open) {
      setF(editing ? { ...editing } : { treatment_name: '', items: [{ item_id: '', item_name: '', suggested_quantity: 1, unit: '' }] })
      setTreatmentSearch('')
      setFromTreatmentTemplate(false)
    }
  }, [open, editing])

  useEffect(() => {
    const searchTreatments = async () => {
      if (treatmentSearch.length < 2) {
        setTreatmentResults([])
        return
      }
      setTreatmentLoading(true)
      try {
        const r = await fetch(`/api/catalog/treatments?q=${encodeURIComponent(treatmentSearch)}`)
        const d = await r.json()
        setTreatmentResults(d.treatments || [])
      } catch (e) {
        setTreatmentResults([])
      } finally {
        setTreatmentLoading(false)
      }
    }
    const debounce = setTimeout(searchTreatments, 300)
    return () => clearTimeout(debounce)
  }, [treatmentSearch])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (treatmentSearchRef.current && !treatmentSearchRef.current.contains(e.target)) {
        setShowTreatmentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectTreatmentTemplate = (treatment) => {
    const materialItems = treatment.suggested_materials.map(mat => {
      const matchedItem = items.find(i => i.item_name.toLowerCase() === mat.item_name.toLowerCase())
      return {
        item_id: matchedItem?.id || '',
        item_name: mat.item_name,
        suggested_quantity: mat.suggested_quantity,
        unit: mat.unit
      }
    })
    setF({ treatment_name: treatment.treatment_name, items: materialItems })
    setTreatmentSearch(treatment.treatment_name)
    setShowTreatmentDropdown(false)
    setFromTreatmentTemplate(true)
  }

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
    const itemsWithoutId = f.items.filter(item => !item.item_id)
    if (itemsWithoutId.length > 0) {
      const missingNames = itemsWithoutId.map(item => item.item_name).join(', ')
      toast.error(`These items need to be added to inventory first: ${missingNames}`)
      return
    }
    for (const item of f.items) {
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
          <div className="space-y-1.5" ref={treatmentSearchRef}>
            <Label>Start from a treatment template (optional)</Label>
            <div className="relative">
              <Input 
                value={treatmentSearch} 
                onChange={e => setTreatmentSearch(e.target.value)}
                onFocus={() => setShowTreatmentDropdown(true)}
                placeholder="Search treatment (e.g. Root Canal, Crown...)"
              />
              {showTreatmentDropdown && treatmentSearch.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {treatmentLoading ? (
                    <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin"/>Searching...
                    </div>
                  ) : treatmentResults.length > 0 ? (
                    treatmentResults.slice(0, 8).map(treatment => (
                      <button
                        key={treatment.id}
                        type="button"
                        onClick={() => selectTreatmentTemplate(treatment)}
                        className="w-full px-3 py-2 text-left hover:bg-muted border-b border-border last:border-0 flex items-center justify-between"
                      >
                        <span className="text-sm">{treatment.treatment_name}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{treatment.category}</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">No treatment templates found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {fromTreatmentTemplate && (
            <div className="bg-[#0D9488]/10 border border-[#0D9488]/20 rounded-md p-3">
              <p className="text-sm text-[#0D9488]">Materials pre-filled from treatment template. Adjust quantities as needed.</p>
            </div>
          )}

          <div className="space-y-1.5"><Label>Treatment Name <span className="text-[#EF4444]">*</span></Label><Input value={f.treatment_name} onChange={e=>setF({...f,treatment_name:e.target.value})} placeholder="e.g. Composite Filling" autoFocus/></div>
          
          <div className="space-y-2">
            <Label>Materials</Label>
            {f.items.map((item, idx) => (
              <MaterialRow key={idx} item={item} idx={idx} items={items} updateItem={updateItem} removeItem={removeItem} canRemove={f.items.length > 1} />
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

function MaterialRow({ item, idx, items, updateItem, removeItem, canRemove }) {
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogResults, setCatalogResults] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false)
  const [fromCatalog, setFromCatalog] = useState(false)
  const searchRef = { current: null }

  useEffect(() => {
    setCatalogSearch(item.item_name)
    setFromCatalog(false)
  }, [item.item_name])

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

  const selectCatalogItem = (catalogItem) => {
    updateItem(idx, 'item_name', catalogItem.item_name)
    updateItem(idx, 'unit', catalogItem.unit)
    const matchedItem = items.find(i => i.item_name.toLowerCase() === catalogItem.item_name.toLowerCase())
    if (matchedItem) {
      updateItem(idx, 'item_id', matchedItem.id)
    }
    setCatalogSearch(catalogItem.item_name)
    setShowCatalogDropdown(false)
    setFromCatalog(true)
  }

  return (
    <div className="flex items-center gap-2" ref={searchRef}>
      <div className="flex-1 relative">
        <Input 
          value={catalogSearch || item.item_name} 
          onChange={e => { 
            const newValue = e.target.value
            setCatalogSearch(newValue)
            updateItem(idx, 'item_name', newValue)
            setFromCatalog(false)
            const matchedItem = items.find(i => i.item_name.toLowerCase() === newValue.toLowerCase())
            if (matchedItem) {
              updateItem(idx, 'item_id', matchedItem.id)
            } else {
              updateItem(idx, 'item_id', '')
            }
          }}
          onFocus={() => setShowCatalogDropdown(true)}
          placeholder="Search catalog or type custom..."
          className="text-sm"
        />
        {fromCatalog && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-[#0D9488] text-white px-2 py-0.5 rounded">catalog</span>
        )}
        {!item.item_id && item.item_name && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">not in inventory — add it first</span>
        )}
        {showCatalogDropdown && catalogSearch.length >= 2 && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {catalogLoading ? (
              <div className="p-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin"/>Searching...
              </div>
            ) : catalogResults.length > 0 ? (
              catalogResults.slice(0, 6).map(catalogItem => (
                <button
                  key={catalogItem.id}
                  type="button"
                  onClick={() => selectCatalogItem(catalogItem)}
                  className="w-full px-2 py-1.5 text-left hover:bg-muted border-b border-border last:border-0 flex items-center justify-between"
                >
                  <span className="text-xs">{catalogItem.item_name}</span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{catalogItem.category}</span>
                </button>
              ))
            ) : (
              <div className="p-2 text-xs text-muted-foreground">No matches</div>
            )}
          </div>
        )}
      </div>
      <Input 
        type="number" 
        value={item.suggested_quantity} 
        onChange={e => updateItem(idx, 'suggested_quantity', parseInt(e.target.value) || 0)}
        placeholder="Qty" 
        className="w-20"
        min="1"
      />
      <span className="text-sm text-muted-foreground w-12">{item.unit}</span>
      {canRemove && (
        <button type="button" onClick={() => removeItem(idx)} className="w-7 h-7 rounded hover:bg-red-50 flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-red-500"/>
        </button>
      )}
    </div>
  )
}

export default function TreatmentTemplatesPage() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
