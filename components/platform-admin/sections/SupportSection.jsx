'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  Bug,
  CalendarClock,
  FileText,
  HeadphonesIcon,
  Loader2,
  PhoneCall,
  Plus,
  RefreshCw,
  Sparkles,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SectionHeading } from '@/components/platform-admin/Placeholder'
import { fmtDateTime, fmtRelative } from '@/components/platform-admin/format'

const NOTE_TYPES = [
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'issue', label: 'Issue', icon: Bug },
  { value: 'feature_request', label: 'Feature Request', icon: Sparkles },
  { value: 'call_log', label: 'Call Log', icon: PhoneCall },
]

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['open', 'in_progress', 'resolved']

const PRIORITY_VARIANT = {
  low: 'secondary',
  medium: 'outline',
  high: 'outline',
  critical: 'destructive',
}
const PRIORITY_COLOR = {
  low: '',
  medium: 'text-amber-600 border-amber-400',
  high: 'text-orange-600 border-orange-400',
  critical: '',
}

const NOTE_ICON = {
  note: FileText,
  issue: Bug,
  feature_request: Sparkles,
  call_log: PhoneCall,
}
const NOTE_COLOR = {
  note: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  issue: 'bg-red-500/10 text-red-600 dark:text-red-400',
  feature_request: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  call_log: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

export default function SupportSection({ clinic }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Add note form
  const [noteType, setNoteType] = useState('note')
  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // Metadata edit
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaForm, setMetaForm] = useState({})
  const [savingMeta, setSavingMeta] = useState(false)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/support`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setData(d)
      setMetaForm({
        priority: d.support?.priority || 'medium',
        status: d.support?.status || 'open',
        assigned_engineer: d.support?.assigned_engineer || '',
        contact_email: d.support?.contact_email || '',
        next_followup_at: d.support?.next_followup_at
          ? new Date(d.support.next_followup_at).toISOString().slice(0, 16)
          : '',
        last_call_at: d.support?.last_call_at
          ? new Date(d.support.last_call_at).toISOString().slice(0, 16)
          : '',
      })
    } catch {
      toast.error('Failed to load support data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [clinic.id])

  useEffect(() => { load() }, [load])

  const addNote = async () => {
    if (!noteContent.trim()) { toast.error('Note cannot be empty'); return }
    setAddingNote(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_note', type: noteType, content: noteContent }),
      })
      if (!r.ok) { const d = await r.json(); toast.error(d.error || 'Failed'); return }
      setNoteContent('')
      toast.success('Note added')
      await load({ silent: true })
    } catch {
      toast.error('Network error')
    } finally {
      setAddingNote(false)
    }
  }

  const saveMeta = async () => {
    setSavingMeta(true)
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_metadata', ...metaForm }),
      })
      if (!r.ok) { const d = await r.json(); toast.error(d.error || 'Failed'); return }
      toast.success('Support metadata saved')
      setEditingMeta(false)
      await load({ silent: true })
    } catch {
      toast.error('Network error')
    } finally {
      setSavingMeta(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const s = data?.support
  const notes = data?.notes || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeading title="Support Center" description="Internal support workspace for this clinic." />
        <Button variant="outline" size="sm" onClick={() => load({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Metadata card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Support Metadata</CardTitle>
          {!editingMeta ? (
            <Button variant="outline" size="sm" onClick={() => setEditingMeta(true)}>Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingMeta(false)}>Cancel</Button>
              <Button size="sm" onClick={saveMeta} disabled={savingMeta}>
                {savingMeta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {editingMeta ? (
            <>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={metaForm.priority} onValueChange={v => setMetaForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={metaForm.status} onValueChange={v => setMetaForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Engineer</Label>
                <Input value={metaForm.assigned_engineer} onChange={e => setMetaForm(f => ({ ...f, assigned_engineer: e.target.value }))} placeholder="engineer@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Email</Label>
                <Input value={metaForm.contact_email} onChange={e => setMetaForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="clinic@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Last Call</Label>
                <Input type="datetime-local" value={metaForm.last_call_at} onChange={e => setMetaForm(f => ({ ...f, last_call_at: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Next Follow-up</Label>
                <Input type="datetime-local" value={metaForm.next_followup_at} onChange={e => setMetaForm(f => ({ ...f, next_followup_at: e.target.value }))} />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-32">Priority</span>
                <Badge
                  variant={PRIORITY_VARIANT[s?.priority] || 'outline'}
                  className={PRIORITY_COLOR[s?.priority] || ''}
                >
                  {s?.priority || 'medium'}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-32">Status</span>
                <Badge variant="outline">{s?.status || 'open'}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{s?.assigned_engineer || <span className="text-muted-foreground">Unassigned</span>}</span>
              </div>
              <div className="flex items-center gap-3">
                <HeadphonesIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{s?.contact_email || <span className="text-muted-foreground">—</span>}</span>
              </div>
              <div className="flex items-center gap-3">
                <PhoneCall className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{s?.last_call_at ? fmtDateTime(s.last_call_at) : <span className="text-muted-foreground">No calls logged</span>}</span>
              </div>
              <div className="flex items-center gap-3">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{s?.next_followup_at ? fmtDateTime(s.next_followup_at) : <span className="text-muted-foreground">No follow-up set</span>}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add note */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {NOTE_TYPES.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNoteType(t.value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    noteType === t.value
                      ? 'border-primary bg-primary/5 font-medium text-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
          <Textarea
            placeholder={`Add ${NOTE_TYPES.find(t => t.value === noteType)?.label.toLowerCase()}…`}
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            rows={3}
          />
          <Button size="sm" onClick={addNote} disabled={addingNote || !noteContent.trim()}>
            {addingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Entry
          </Button>
        </CardContent>
      </Card>

      {/* Notes list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">History ({notes.length})</h3>
        {notes.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">No support entries yet</p>
          </div>
        ) : (
          notes.map(note => {
            const Icon = NOTE_ICON[note.type] || FileText
            const colorClass = NOTE_COLOR[note.type] || 'bg-slate-500/10 text-slate-600'
            return (
              <div key={note.id} className="flex gap-3 rounded-lg border border-border p-4">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass.split(' ')[0]}`}>
                  <Icon className={`h-4 w-4 ${colorClass.split(' ').slice(1).join(' ')}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{NOTE_TYPES.find(t => t.value === note.type)?.label || note.type}</Badge>
                    <span className="text-xs text-muted-foreground">{note.author_email}</span>
                    <span className="text-xs text-muted-foreground" title={fmtDateTime(note.created_at)}>
                      {fmtRelative(note.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
