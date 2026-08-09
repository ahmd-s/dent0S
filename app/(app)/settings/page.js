'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Copy, ExternalLink, Trash2, Edit2, FileText, Check, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { toast } from 'sonner'
import { canAccessSettings } from '@/lib/rbac'
import { getProfileRoles, VALID_ROLES } from '@/lib/profile-roles'
import { ToothIcon } from '@/components/dentos/Logo'
import ImageUpload from '@/components/dentos/ImageUpload'
import { useRole } from '@/components/dentos/RoleContext'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const TIMES = (() => { const arr = []; for (let h=6; h<=22; h++) for (let m=0;m<60;m+=30) { const hh=h%12===0?12:h%12, ap=h<12?'AM':'PM'; arr.push(`${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`) } return arr })()

const fmtLastLogin = t => {
  if (!t) return '—'
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function App() {
  const [me, setMe] = useState(null)
  useEffect(() => { fetch('/api/auth/me').then(r=>r.json()).then(setMe) }, [])
  return (
    <div className="max-w-4xl mx-auto">
      {me?.profile && canAccessSettings(me.profile) && (
        <Link
          href="/settings/workspace"
          className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#0D9488]/10 text-[#0D9488]">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Workspace Builder</p>
              <p className="text-xs text-muted-foreground">Customize navigation, dashboard, and layout per role</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground group-hover:text-foreground">Open →</span>
        </Link>
      )}
      <Tabs defaultValue="clinic">
        <TabsList className="bg-muted"><TabsTrigger value="clinic">Clinic Profile</TabsTrigger><TabsTrigger value="team">Team</TabsTrigger><TabsTrigger value="availability">Doctor Availability</TabsTrigger><TabsTrigger value="consent">Consent Forms</TabsTrigger></TabsList>
        <TabsContent value="clinic" className="mt-4 space-y-5"><ClinicTab me={me} reload={()=>fetch('/api/auth/me').then(r=>r.json()).then(setMe)}/></TabsContent>
        <TabsContent value="team" className="mt-4"><TeamTab/></TabsContent>
        <TabsContent value="availability" className="mt-4"><DoctorAvailabilityTab me={me}/></TabsContent>
        <TabsContent value="consent" className="mt-4"><ConsentFormsTab/></TabsContent>
      </Tabs>
    </div>
  )
}

function ClinicTab({ me, reload }) {
  const { refresh: refreshRole } = useRole()
  const [c, setC] = useState(null)
  const [hours, setHours] = useState(DAYS.map(d => ({ day:d, open: d!=='Sun', start:'10:00 AM', end:'07:00 PM' })))
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])
  const [tplOpen, setTplOpen] = useState(false)
  const [tpl, setTpl] = useState({ id:null, name:'', category:'', default_notes:'', default_price:'' })

  useEffect(() => { if (me?.clinic) { setC(me.clinic); if (Array.isArray(me.clinic.working_hours) && me.clinic.working_hours.length) setHours(me.clinic.working_hours) } }, [me])
  useEffect(() => { fetch('/api/treatment_templates').then(r=>r.json()).then(d=>setTemplates(d.templates||[])) }, [])

  if (!c) return <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/>

  const save = async () => {
    setSaving(true)
    const r = await fetch('/api/clinic', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: c.name, phone: c.phone, address: c.address, city: c.city, gstin: c.gstin, logo_url: c.logo_url, working_hours: hours }) })
    setSaving(false)
    if (r.ok) { toast.success('Saved'); reload(); refreshRole() } else toast.error('Failed')
  }
  const updateSlug = async () => {
    const r = await fetch('/api/clinic', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ slug: c.slug }) })
    const d = await r.json()
    if (r.ok) { toast.success('Slug updated'); reload() } else toast.error(d.error||'Failed')
  }
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const bookingLink = `${baseUrl}/book/${c.slug}`

  const saveTpl = async () => {
    const url = tpl.id ? `/api/treatment_templates/${tpl.id}` : '/api/treatment_templates'
    const r = await fetch(url, { method: tpl.id?'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(tpl) })
    if (r.ok) { toast.success('Saved'); setTplOpen(false); fetch('/api/treatment_templates').then(r=>r.json()).then(d=>setTemplates(d.templates||[])) } else toast.error('Failed')
  }
  const deleteTpl = async id => {
    if (!confirm('Delete template?')) return
    const r = await fetch(`/api/treatment_templates/${id}`, { method:'DELETE' })
    if (r.ok) { toast.success('Deleted'); setTemplates(p => p.filter(t => t.id !== id)) }
  }

  return (
    <>
      <Card className="p-6 bg-card border-border rounded-lg">
        <h3 className="font-semibold mb-4">Clinic Profile</h3>
        <div className="space-y-1.5 mb-5">
          <Label>Clinic Logo</Label>
          <ImageUpload
            value={c.logo_url}
            onChange={url => { setC({ ...c, logo_url: url }); reload(); refreshRole() }}
            uploadUrl="/api/clinic/logo"
            fallback={<ToothIcon className="w-8 h-8 text-white" />}
            helperText="JPG, PNG or WEBP. Max 5MB. Appears in your sidebar and on invoices."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2"><Label>Clinic Name</Label><Input value={c.name||''} onChange={e=>setC({...c,name:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={c.phone||''} onChange={e=>setC({...c,phone:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>City</Label><Input value={c.city||''} onChange={e=>setC({...c,city:e.target.value})}/></div>
          <div className="space-y-1.5 col-span-2"><Label>Address</Label><Textarea rows={2} value={c.address||''} onChange={e=>setC({...c,address:e.target.value})}/></div>
          <div className="space-y-1.5"><Label>GSTIN</Label><Input value={c.gstin||''} onChange={e=>setC({...c,gstin:e.target.value})}/></div>
        </div>
        <h4 className="font-medium mt-6 mb-3">Working Hours</h4>
        {hours.map((h,i) => (
          <div key={h.day} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
            <div className="w-12 font-medium text-sm">{h.day}</div>
            <div className="flex items-center gap-2 w-28"><Switch checked={h.open} onCheckedChange={v=>setHours(p=>p.map((x,j)=>j===i?{...x,open:v}:x))}/><span className="text-sm text-muted-foreground">{h.open?'Open':'Closed'}</span></div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <Select value={h.start} disabled={!h.open} onValueChange={v=>setHours(p=>p.map((x,j)=>j===i?{...x,start:v}:x))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TIMES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              <Select value={h.end} disabled={!h.open} onValueChange={v=>setHours(p=>p.map((x,j)=>j===i?{...x,end:v}:x))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TIMES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
        ))}
        <div className="mt-4 flex justify-end"><Button onClick={save} disabled={saving} className="bg-[#0D9488] hover:bg-[#0B7E73]">{saving?<Loader2 className="w-4 h-4 animate-spin"/>:'Save Changes'}</Button></div>
      </Card>

      <Card className="p-6 bg-card border-border rounded-lg mt-5">
        <h3 className="font-semibold mb-1">Public Booking Page</h3>
        <p className="text-sm text-muted-foreground mb-3">Share this link with patients to let them book online.</p>
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md border border-border">
          <span className="flex-1 font-mono text-sm break-all">{bookingLink}</span>
          <button onClick={()=>{navigator.clipboard.writeText(bookingLink); toast.success('Copied')}} className="px-2 py-1 hover:bg-card rounded"><Copy className="w-4 h-4 text-muted-foreground"/></button>
          <a href={bookingLink} target="_blank" rel="noreferrer" className="px-2 py-1 hover:bg-card rounded"><ExternalLink className="w-4 h-4 text-muted-foreground"/></a>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input value={c.slug} onChange={e=>setC({...c,slug:e.target.value})} className="font-mono text-sm" placeholder="clinic-slug"/>
          <Button variant="outline" size="sm" onClick={updateSlug}>Update Slug</Button>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">⚠️ Changing this will break existing shared links</p>
      </Card>

      <Card className="p-6 bg-card border-border rounded-lg mt-5">
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Treatment Templates</h3><Button size="sm" onClick={()=>{setTpl({id:null,name:'',category:'',default_notes:'',default_price:''}); setTplOpen(true)}}><Plus className="w-4 h-4 mr-1"/>Add Template</Button></div>
        {templates.length === 0 && <div className="text-sm text-muted-foreground py-2">No templates yet. Add common treatments to apply them quickly during visits.</div>}
        {templates.map(t => (
          <div key={t.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
            <div className="flex-1"><div className="font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.category||'—'} · {t.default_notes?.slice(0,80)||'No notes'}</div></div>
            <div className="text-sm font-medium">₹{t.default_price?.toLocaleString('en-IN')||0}</div>
            <button onClick={()=>{setTpl({...t, default_price: String(t.default_price||'')}); setTplOpen(true)}} className="p-1.5 hover:bg-muted rounded"><Edit2 className="w-4 h-4 text-muted-foreground"/></button>
            <button onClick={()=>deleteTpl(t.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
          </div>
        ))}
      </Card>

      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{tpl.id?'Edit Template':'Add Template'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={tpl.name} onChange={e=>setTpl({...tpl,name:e.target.value})} placeholder="e.g. Composite filling"/></div>
            <div className="space-y-1.5"><Label>Category</Label><Input value={tpl.category} onChange={e=>setTpl({...tpl,category:e.target.value})} placeholder="e.g. Restorative"/></div>
            <div className="space-y-1.5"><Label>Default Notes</Label><Textarea rows={3} value={tpl.default_notes} onChange={e=>setTpl({...tpl,default_notes:e.target.value})} placeholder="Standard treatment description…"/></div>
            <div className="space-y-1.5"><Label>Default Price (₹)</Label><Input type="number" value={tpl.default_price} onChange={e=>setTpl({...tpl,default_price:e.target.value})}/></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setTplOpen(false)}>Cancel</Button><Button onClick={saveTpl} className="bg-[#0D9488] hover:bg-[#0B7E73]">Save</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RoleCheckboxGroup({ value, onChange, disabled, className }) {
  const labels = { admin: 'Admin', doctor: 'Doctor', receptionist: 'Receptionist' }
  const toggle = (role) => {
    if (disabled) return
    const set = new Set(value || [])
    if (set.has(role)) {
      set.delete(role)
    } else {
      set.add(role)
    }
    const next = VALID_ROLES.filter(r => set.has(r))
    if (next.length === 0) {
      toast.error('At least one role is required')
      return
    }
    onChange(next)
  }
  return (
    <div className={className || 'flex flex-wrap gap-4'}>
      {VALID_ROLES.map(role => (
        <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={(value || []).includes(role)} onCheckedChange={() => toggle(role)} disabled={disabled} />
          {labels[role]}
        </label>
      ))}
    </div>
  )
}

function TeamTab() {
  const { me } = useRole()
  const [team, setTeam] = useState([])
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [f, setF] = useState({ full_name:'', email:'', roles:['doctor'], password:'', whatsapp_number:'', consultation_fee:'' })
  const [editingWhatsApp, setEditingWhatsApp] = useState(null)
  const [whatsappValue, setWhatsappValue] = useState('')
  const [editingFee, setEditingFee] = useState(null)
  const [feeValue, setFeeValue] = useState('')
  const [editMember, setEditMember] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', password: '' })
  const load = () => fetch('/api/team').then(r=>r.json()).then(d=>setTeam(d.team||[]))
  useEffect(() => { load() }, [])
  const invite = async () => {
    if (!f.roles?.length) { toast.error('Select at least one role'); return }
    const r = await fetch('/api/team', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...f, roles: f.roles }) })
    const d = await r.json()
    if (r.ok) {
      toast.success(d.invite_email_sent ? 'Invitation email sent with login details.' : 'Team member added.')
      setOpen(false); setF({full_name:'',email:'',roles:['doctor'],password:'',whatsapp_number:'',consultation_fee:''}); load()
    } else toast.error(d.error||'Failed')
  }
  const toggleActive = async (m) => {
    const r = await fetch(`/api/team/${m.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ is_active: !m.is_active }) })
    if (r.ok) { toast.success('Updated'); load() }
  }
  const deleteMember = async () => {
    if (!deleteTarget) return
    const r = await fetch(`/api/team/${deleteTarget.id}`, { method:'DELETE' })
    const d = await r.json()
    if (r.ok) { toast.success('Team member removed'); setDeleteTarget(null); load() }
    else toast.error(d.error || 'Failed to delete')
  }
  const updateRoles = async (m, roles) => {
    const r = await fetch(`/api/team/${m.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ roles }) })
    if (r.ok) { toast.success('Roles updated'); load() }
    else toast.error((await r.json()).error || 'Failed')
  }
  const updateConsultationFee = async (m) => {
    const r = await fetch(`/api/team/${m.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ consultation_fee: feeValue === '' ? null : feeValue }) })
    if (r.ok) { toast.success('Consultation fee updated'); setEditingFee(null); load() }
    else toast.error('Failed')
  }
  const updateWhatsApp = async (m) => {
    if (!/^\d{10}$/.test(whatsappValue)) {
      toast.error('Please enter a valid 10-digit mobile number')
      return
    }
    const r = await fetch(`/api/team/${m.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ whatsapp_number: whatsappValue }) })
    if (r.ok) { toast.success('WhatsApp number updated'); setEditingWhatsApp(null); setWhatsappValue(''); load() }
    else toast.error('Failed')
  }
  const openEditMember = (m) => {
    setEditMember(m)
    setEditForm({ full_name: m.full_name || '', email: m.email || '', password: '' })
  }
  const saveMemberEdit = async () => {
    if (!editMember) return
    if (!editForm.full_name.trim()) { toast.error('Name is required'); return }
    if (!editForm.email.trim()) { toast.error('Email is required'); return }
    const body = { full_name: editForm.full_name.trim(), email: editForm.email.trim() }
    if (editForm.password) body.password = editForm.password
    const r = await fetch(`/api/team/${editMember.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    if (r.ok) {
      toast.success('Team member updated')
      setEditMember(null)
      setEditForm({ full_name: '', email: '', password: '' })
      load()
    } else toast.error(d.error || 'Failed')
  }
  const formatWhatsApp = (num) => num ? `+91 ${num}` : '—'
  const currentUserId = me?.profile?.id
  const ownerId = me?.clinic?.owner_id
  const canDelete = (m) => m.id !== currentUserId && m.id !== ownerId
  return (
    <Card className="p-6 bg-card border-border rounded-lg max-w-6xl">
      <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Team Members ({team.length})</h3><Button size="sm" onClick={()=>setOpen(true)} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Invite</Button></div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Name</TableHead>
            <TableHead className="min-w-[180px]">Email</TableHead>
            <TableHead className="w-[130px]">WhatsApp</TableHead>
            <TableHead className="min-w-[240px]">Roles</TableHead>
            <TableHead className="w-[130px]">Consultation fee</TableHead>
            <TableHead className="w-[120px]">Last login</TableHead>
            <TableHead className="w-[90px]">Status</TableHead>
            <TableHead className="w-[200px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.map(m => {
            const memberRoles = getProfileRoles(m)
            const isDoctorMember = memberRoles.includes('doctor')
            const isAdminMember = memberRoles.includes('admin')
            return (
            <TableRow key={m.id}>
              <TableCell className="font-medium min-w-[140px]">{m.full_name}</TableCell>
              <TableCell className="text-muted-foreground min-w-[180px] max-w-[220px] truncate">{m.email}</TableCell>
              <TableCell className="w-[130px]">
                {editingWhatsApp === m.id ? (
                  <div className="flex items-center gap-2">
                    <Input type="text" value={whatsappValue} onChange={e=>setWhatsappValue(e.target.value)} placeholder="10 digits" className="w-28 h-8" maxLength={10}/>
                    <button onClick={()=>updateWhatsApp(m)} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4"/></button>
                    <button onClick={()=>{setEditingWhatsApp(null); setWhatsappValue('')}} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={isDoctorMember ? '' : 'text-muted-foreground'}>{isDoctorMember ? formatWhatsApp(m.whatsapp_number) : '—'}</span>
                    {isDoctorMember && <button onClick={()=>{setEditingWhatsApp(m.id); setWhatsappValue(m.whatsapp_number||'')}} className="text-muted-foreground hover:text-[#0D9488]"><Edit2 className="w-3.5 h-3.5"/></button>}
                  </div>
                )}
              </TableCell>
              <TableCell className="min-w-[240px]">
                <RoleCheckboxGroup
                  value={memberRoles}
                  onChange={roles => updateRoles(m, roles)}
                  className="flex flex-nowrap items-center gap-x-4"
                />
              </TableCell>
              <TableCell className="w-[130px] whitespace-nowrap">
                {isDoctorMember ? (
                  editingFee === m.id ? (
                    <div className="flex items-center gap-2">
                      <Input type="number" value={feeValue} onChange={e=>setFeeValue(e.target.value)} className="w-24 h-8" placeholder="₹" />
                      <button onClick={()=>updateConsultationFee(m)} className="text-green-600"><Check className="w-4 h-4"/></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{m.consultation_fee != null ? `₹${Number(m.consultation_fee).toLocaleString('en-IN')}` : '—'}</span>
                      <button onClick={()=>{setEditingFee(m.id); setFeeValue(m.consultation_fee ?? '')}} className="text-muted-foreground hover:text-[#0D9488]"><Edit2 className="w-3.5 h-3.5"/></button>
                    </div>
                  )
                ) : '—'}
              </TableCell>
              <TableCell className="w-[120px] text-muted-foreground text-xs whitespace-nowrap">{fmtLastLogin(m.last_login_at)}</TableCell>
              <TableCell className="w-[90px]">{m.is_active?<span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">Active</span>:<span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">Inactive</span>}</TableCell>
              <TableCell className="w-[200px] text-right">
                <div className="flex items-center justify-end gap-2">
                  {!isAdminMember && (
                    <Button size="sm" variant="outline" onClick={()=>openEditMember(m)} className="h-8 px-2" title="Edit member">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={()=>toggleActive(m)} className="h-8">{m.is_active?'Deactivate':'Activate'}</Button>
                  {canDelete(m) && (
                    <Button size="sm" variant="outline" onClick={()=>setDeleteTarget(m)} className="h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">Delete</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={f.full_name} onChange={e=>setF({...f,full_name:e.target.value})}/></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></div>
            <div className="space-y-1.5"><Label>Roles</Label><RoleCheckboxGroup value={f.roles} onChange={roles => setF({ ...f, roles })} /></div>
            {f.roles?.includes('doctor') && <div className="space-y-1.5"><Label>WhatsApp Number (for daily schedule)</Label><Input type="text" value={f.whatsapp_number} onChange={e=>setF({...f,whatsapp_number:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10-digit mobile number" maxLength={10}/></div>}
            {f.roles?.includes('doctor') && <div className="space-y-1.5"><Label>Consultation fee (₹)</Label><Input type="number" value={f.consultation_fee} onChange={e=>setF({...f,consultation_fee:e.target.value})} placeholder="Default per visit"/></div>}
            <div className="space-y-1.5"><Label>Temporary Password</Label><Input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="min 8 characters"/></div>
            <Button onClick={invite} className="w-full bg-[#0D9488] hover:bg-[#0B7E73]">Add Member</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editMember} onOpenChange={open => { if (!open) { setEditMember(null); setEditForm({ full_name: '', email: '', password: '' }) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Team Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={editForm.full_name} onChange={e=>setEditForm({ ...editForm, full_name: e.target.value })}/></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e=>setEditForm({ ...editForm, email: e.target.value })}/></div>
            <div className="space-y-1.5"><Label>New Password</Label><Input type="password" value={editForm.password} onChange={e=>setEditForm({ ...editForm, password: e.target.value })} placeholder="Leave blank to keep current"/></div>
            <Button onClick={saveMemberEdit} className="w-full bg-[#0D9488] hover:bg-[#0B7E73]">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.full_name} from your team. Their past activity will be preserved for records. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteMember} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function ConsentFormsTab() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [template, setTemplate] = useState({ id: null, name: '', category: 'General', content: '', active: true })

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/consent-templates')
    const d = await r.json()
    setTemplates(d.templates || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!template.name || !template.content) { toast.error('Name and content required'); return }
    const url = template.id ? `/api/consent-templates/${template.id}` : '/api/consent-templates'
    const r = await fetch(url, { method: template.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(template) })
    if (r.ok) { toast.success('Saved'); setOpen(false); setTemplate({ id: null, name: '', category: 'General', content: '', active: true }); load() }
    else toast.error('Failed')
  }

  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return
    const r = await fetch(`/api/consent-templates/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Deleted'); setTemplates(p => p.filter(t => t.id !== id)) }
    else toast.error('Failed')
  }

  const toggleActive = async (t) => {
    const r = await fetch(`/api/consent-templates/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !t.active }) })
    if (r.ok) { toast.success('Updated'); load() }
    else toast.error('Failed')
  }

  const seedDefaults = async () => {
    const r = await fetch('/api/seed-consent-templates', { method: 'POST' })
    const d = await r.json()
    if (r.ok) { toast.success(d.message || 'Default templates loaded'); load() }
    else toast.error(d.error || 'Failed to load templates')
  }

  return (
    <Card className="p-6 bg-card border-border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Consent Form Templates</h3>
        <Button size="sm" onClick={() => { setTemplate({ id: null, name: '', category: 'General', content: '', active: true }); setOpen(true) }} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Template</Button>
      </div>
      {loading && <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0D9488]"/></div>}
      {!loading && templates.length === 0 && (
        <div className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40"/>
          <p className="mt-3 text-muted-foreground text-sm">No consent templates yet. Create reusable consent forms for your clinic.</p>
          <Button onClick={seedDefaults} variant="outline" className="mt-4">
            <FileText className="w-4 h-4 mr-2"/>Load Default Templates
          </Button>
        </div>
      )}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{t.name}</div>
                  {!t.active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Inactive</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t.category} · {t.content?.slice(0, 100)}...</div>
              </div>
              <Switch checked={t.active} onCheckedChange={() => toggleActive(t)}/>
              <button onClick={() => { setTemplate({ ...t }); setOpen(true) }} className="p-1.5 hover:bg-muted rounded"><Edit2 className="w-4 h-4 text-muted-foreground"/></button>
              <button onClick={() => deleteTemplate(t.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{template.id ? 'Edit Template' : 'Add Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Template Name</Label><Input value={template.name} onChange={e => setTemplate({ ...template, name: e.target.value })} placeholder="e.g. Root Canal Consent"/></div>
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={template.category} onValueChange={v => setTemplate({ ...template, category: v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Treatment">Treatment</SelectItem>
                  <SelectItem value="Photography">Photography</SelectItem>
                  <SelectItem value="Data Privacy">Data Privacy</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Consent Content (Rich Text)</Label><Textarea rows={10} value={template.content} onChange={e => setTemplate({ ...template, content: e.target.value })} placeholder="Enter the consent form text here..."/></div>
            <div className="flex items-center gap-2"><Switch checked={template.active} onCheckedChange={v => setTemplate({ ...template, active: v })}/><Label className="text-sm">Active</Label></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} className="bg-[#0D9488] hover:bg-[#0B7E73]">Save Template</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function DoctorAvailabilityTab({ me }) {
  const [blocks, setBlocks] = useState([])
  const [doctors, setDoctors] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ doctor_id: '', date: '', start_time: '', end_time: '', reason: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [blocksRes, docsRes] = await Promise.all([
      fetch('/api/block-times'),
      fetch('/api/doctors')
    ])
    const blocksData = await blocksRes.json()
    const docsData = await docsRes.json()
    setBlocks(blocksData.blocks || [])
    setDoctors(docsData.doctors || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const canEdit = canAccessSettings(me?.profile?.role)

  const save = async () => {
    if (saving) return
    if (!form.doctor_id || !form.date || !form.start_time || !form.end_time || !form.reason) {
      toast.error('Please fill in all required fields')
      return
    }
    setSaving(true)
    const r = await fetch('/api/block-times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (r.ok) {
      toast.success('Block added')
      setOpen(false)
      setForm({ doctor_id: '', date: '', start_time: '', end_time: '', reason: '' })
      load()
    } else {
      const d = await r.json()
      toast.error(d.error || 'Failed')
    }
    setSaving(false)
  }

  const deleteBlock = async (id) => {
    if (!confirm('Delete this block?')) return
    const r = await fetch(`/api/block-times/${id}`, { method: 'DELETE' })
    if (r.ok) {
      toast.success('Deleted')
      load()
    } else {
      toast.error('Failed')
    }
  }

  const REASON_OPTIONS = ['Personal', 'Conference', 'Travel', 'Other']

  // Generate 30-min time slots from 06:00 to 22:00
  const TIME_SLOTS = (() => {
    const slots = []
    for (let h = 6; h <= 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }
    }
    return slots
  })()

  return (
    <Card className="p-6 bg-card border-border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Doctor Availability</h3>
        {canEdit && <Button size="sm" onClick={() => { setForm({ doctor_id: '', date: '', start_time: '', end_time: '', reason: '' }); setOpen(true) }} className="bg-[#0D9488] hover:bg-[#0B7E73]"><Plus className="w-4 h-4 mr-1"/>Add Block</Button>}
      </div>
      {loading && <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0D9488]"/></div>}
      {!loading && blocks.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No blocked time slots. Add blocks to mark when doctors are unavailable.</p>
        </div>
      )}
      {!loading && blocks.length > 0 && (
        <div className="space-y-3">
          {blocks.map(block => (
            <div key={block.id} className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50">
              <div className="flex-1">
                <div className="font-medium">{block.doctor_name || 'All Doctors'}</div>
                <div className="text-sm text-muted-foreground">{block.date} · {block.start_time} - {block.end_time}</div>
                <div className="text-xs text-muted-foreground mt-1">{block.reason}</div>
              </div>
              {canEdit && (
                <button onClick={() => deleteBlock(block.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Blocked Time</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Select value={form.doctor_id} onValueChange={v => setForm({ ...form, doctor_id: v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Select value={form.start_time} onValueChange={v => setForm({ ...form, start_time: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Select value={form.end_time} onValueChange={v => setForm({ ...form, end_time: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={form.reason} onValueChange={v => setForm({ ...form, reason: v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-[#0D9488] hover:bg-[#0B7E73]">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Block'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default App
