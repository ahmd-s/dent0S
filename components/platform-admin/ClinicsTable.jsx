'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Mail,
  MoreHorizontal,
  Power,
  PowerOff,
  Search,
  Timer,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ConsoleStatusBadge, InactivityBadge, PlanBadge } from './Badges'
import { ClinicDrawer } from './ClinicDrawer'
import { DeleteClinicDialog } from './DeleteClinicDialog'
import { downloadCsv, fmtDate, fmtRelative, initials } from './format'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'trial', label: 'Trial' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deleted', label: 'Deleted' },
]

const INACTIVITY_FILTERS = [
  { value: 'all', label: 'Any activity' },
  { value: '2', label: 'Inactive 2+ days' },
  { value: '14', label: 'Inactive 14+ days' },
  { value: '30', label: 'Inactive 30+ days' },
  { value: '90', label: 'Inactive 90+ days' },
]

const COLUMNS = [
  { key: 'name', label: 'Clinic Name', sort: 'name' },
  { key: 'owner', label: 'Owner', sort: 'owner' },
  { key: 'email', label: 'Email', sort: 'email' },
  { key: 'phone', label: 'Phone', sort: 'phone' },
  { key: 'plan', label: 'Plan', sort: 'plan' },
  { key: 'status', label: 'Status', sort: 'status' },
  { key: 'last_active', label: 'Last Active', sort: 'last_active' },
  { key: 'created_at', label: 'Created', sort: 'created_at' },
  { key: 'doctors', label: 'Doctors', sort: 'doctors', numeric: true },
  { key: 'patients', label: 'Patients', sort: 'patients', numeric: true },
  { key: 'version', label: 'Version', sort: 'version' },
]

function SortMark({ active, order }) {
  if (!active) return null
  return order === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
}

function buildQuery({ q, status, plan, inactivity, sort, order, page, pageSize, includeDeleted }) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status && status !== 'all') params.set('status', status)
  if (plan && plan !== 'all') params.set('plan', plan)
  if (inactivity && inactivity !== 'all') params.set('inactivity', inactivity)
  if (sort) params.set('sort', sort)
  if (order) params.set('order', order)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (includeDeleted || status === 'deleted') params.set('include_deleted', '1')
  return params.toString()
}

export function ClinicsTable({
  defaultStatus = 'all',
  defaultInactivity = 'all',
  onKpis,
  compact = false,
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState(defaultStatus)
  const [plan, setPlan] = useState('all')
  const [inactivity, setInactivity] = useState(defaultInactivity)
  const [sort, setSort] = useState('created_at')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [plans, setPlans] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [drawerId, setDrawerId] = useState(null)
  const [deleteClinic, setDeleteClinic] = useState(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [bulkReason, setBulkReason] = useState('')
  const [bulkOpen, setBulkOpen] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => { setPage(1) }, [debounced, status, plan, inactivity, sort, order, pageSize])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = buildQuery({
        q: debounced,
        status,
        plan,
        inactivity,
        sort,
        order,
        page,
        pageSize,
        includeDeleted: status === 'deleted',
      })
      const r = await fetch(`/api/platform-admin/clinics?${qs}`)
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error || 'Failed to load clinics')
        return
      }
      const d = await r.json()
      setRows(d.clinics || [])
      setTotal(d.total || 0)
      setPageCount(d.pageCount || 1)
      setPlans(d.plans || [])
      onKpis?.(d.kpis || null)
      setSelected(new Set())
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [debounced, status, plan, inactivity, sort, order, page, pageSize, onKpis])

  useEffect(() => { load() }, [load])

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  const selectedRows = useMemo(() => rows.filter(r => selected.has(r.id)), [rows, selected])

  const toggleSort = key => {
    if (sort === key) setOrder(o => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setOrder(key === 'name' || key === 'owner' ? 'asc' : 'desc')
    }
  }

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(rows.map(r => r.id)))
  }

  const toggleOne = (id, e) => {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const patchRow = (id, patch) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  const runBulk = async (action, extra = {}) => {
    setBulkLoading(true)
    try {
      const r = await fetch('/api/platform-admin/clinics/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, clinic_ids: [...selected], ...extra }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok && d.error) {
        toast.error(d.error)
        return
      }
      if (d.failed) toast.warning(`${d.succeeded} succeeded, ${d.failed} failed`)
      else toast.success(`${d.succeeded || selected.size} clinics updated`)
      setBulkOpen(null)
      setBulkReason('')
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setBulkLoading(false)
    }
  }

  const exportRows = async (onlySelected) => {
    const source = onlySelected ? selectedRows : null
    let data = source
    if (!data) {
      const qs = buildQuery({
        q: debounced, status, plan, inactivity, sort, order, page: 1, pageSize: 100, includeDeleted: status === 'deleted',
      }) + '&all=1'
      const r = await fetch(`/api/platform-admin/clinics?${qs}`)
      const d = await r.json()
      data = d.clinics || []
    }
    downloadCsv('dentos-clinics.csv', [
      { label: 'Clinic Name', value: r => r.name },
      { label: 'Owner', value: r => r.owner_name },
      { label: 'Email', value: r => r.owner_email },
      { label: 'Phone', value: r => r.phone },
      { label: 'Plan', value: r => r.plan_type },
      { label: 'Status', value: r => r.console_status },
      { label: 'Last Active', value: r => r.last_activity },
      { label: 'Created', value: r => r.created_at },
      { label: 'Doctors', value: r => r.doctor_count },
      { label: 'Patients', value: r => r.patient_count },
      { label: 'Version', value: r => r.version },
    ], data)
  }

  const sendEmail = async () => {
    if (!emailBody.trim()) {
      toast.error('Email body is required')
      return
    }
    setEmailLoading(true)
    try {
      const r = await fetch('/api/platform-admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients_filter: 'selected',
          clinic_ids: [...selected],
          channel: 'email',
          subject: emailSubject || 'Message from DentOS',
          body: emailBody,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(d.error || 'Failed to send')
        return
      }
      toast.success('Email queued')
      setEmailOpen(false)
      setEmailBody('')
      setEmailSubject('')
    } catch {
      toast.error('Network error')
    } finally {
      setEmailLoading(false)
    }
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, owner, email, phone"
            className="pl-9"
            aria-label="Search clinics"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by plan"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {plans.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={inactivity} onValueChange={setInactivity}>
            <SelectTrigger className="h-9 w-[180px]" aria-label="Filter by inactivity"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INACTIVITY_FILTERS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => runBulk('activate')}><Power className="mr-1.5 h-3.5 w-3.5" />Activate</Button>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen('deactivate')}><PowerOff className="mr-1.5 h-3.5 w-3.5" />Deactivate</Button>
          <Button size="sm" variant="outline" onClick={() => runBulk('extend_trial', { days: 14 })}><Timer className="mr-1.5 h-3.5 w-3.5" />Extend trial</Button>
          <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}><Mail className="mr-1.5 h-3.5 w-3.5" />Send email</Button>
          <Button size="sm" variant="outline" onClick={() => exportRows(true)}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
          <Button size="sm" variant="destructive" onClick={() => setBulkOpen('delete')}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[1280px]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10 px-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                {COLUMNS.map(col => (
                  <TableHead key={col.key} className={col.numeric ? 'px-3 text-right' : 'px-3'}>
                    <button type="button" className="inline-flex items-center text-xs font-medium uppercase tracking-wide" onClick={() => toggleSort(col.sort)}>
                      {col.label}
                      <SortMark active={sort === col.sort} order={order} />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={13} className="px-3 py-2"><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={13} className="py-16 text-center text-sm text-muted-foreground">
                    No clinics match these filters.
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setDrawerId(c.id)}>
                  <TableCell className="px-3" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id, { stopPropagation() {} })} />
                  </TableCell>
                  <TableCell className="px-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold text-primary">
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.name}</div>
                        {c.inactivity_label && (
                          <InactivityBadge bucket={c.inactivity_bucket} label={c.inactivity_label} />
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 text-sm">{c.owner_name || '—'}</TableCell>
                  <TableCell className="px-3 text-sm text-muted-foreground">{c.owner_email || '—'}</TableCell>
                  <TableCell className="px-3 text-sm tabular-nums">{c.phone || '—'}</TableCell>
                  <TableCell className="px-3"><PlanBadge plan={c.plan_type} /></TableCell>
                  <TableCell className="px-3"><ConsoleStatusBadge status={c.console_status} /></TableCell>
                  <TableCell className="px-3 whitespace-nowrap text-sm text-muted-foreground">{fmtRelative(c.last_activity)}</TableCell>
                  <TableCell className="px-3 whitespace-nowrap text-sm text-muted-foreground">{fmtDate(c.created_at)}</TableCell>
                  <TableCell className="px-3 text-right tabular-nums">{c.doctor_count}</TableCell>
                  <TableCell className="px-3 text-right tabular-nums">{c.patient_count}</TableCell>
                  <TableCell className="px-3 text-sm text-muted-foreground">{c.version}</TableCell>
                  <TableCell className="px-3 text-right" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Clinic actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDrawerId(c.id)}>Open details</DropdownMenuItem>
                        {c.console_status === 'inactive' ? (
                          <DropdownMenuItem onClick={async () => {
                            const r = await fetch(`/api/platform-admin/clinics/${c.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_active: true }),
                            })
                            if (!r.ok) toast.error('Failed to activate')
                            else { toast.success('Clinic activated'); load() }
                          }}>Activate</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setDrawerId(c.id)}>Deactivate…</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={c.is_active !== false}
                          onClick={() => setDeleteClinic(c)}
                        >
                          Permanently delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {compact ? `${total} clinics` : `Showing ${start}–${end} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">{page} / {pageCount}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => exportRows(false)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />CSV
          </Button>
        </div>
      </div>

      <ClinicDrawer
        clinicId={drawerId}
        open={!!drawerId}
        onOpenChange={open => { if (!open) setDrawerId(null) }}
        onClinicChange={patchRow}
        onRequestDelete={clinic => setDeleteClinic(clinic)}
      />
      <DeleteClinicDialog
        clinic={deleteClinic}
        open={!!deleteClinic}
        onOpenChange={open => { if (!open) setDeleteClinic(null) }}
        onDeleted={() => { toast.success('Clinic deleted'); load() }}
      />

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send email to {selected.size} clinics</DialogTitle>
            <DialogDescription>Uses the platform broadcast channel. Delivery depends on email being configured.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="bulk-subject">Subject</Label>
              <Input id="bulk-subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="bulk-body">Body</Label>
              <Textarea id="bulk-body" rows={5} value={emailBody} onChange={e => setEmailBody(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button onClick={sendEmail} disabled={emailLoading}>
              {emailLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bulkOpen} onOpenChange={open => { if (!open) setBulkOpen(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bulkOpen === 'delete' ? 'Bulk permanent delete' : 'Deactivate clinics'}</DialogTitle>
            <DialogDescription>
              {bulkOpen === 'delete'
                ? 'Only inactive clinics will be deleted. Type DELETE to confirm. This cannot be undone.'
                : 'Staff at selected clinics will be blocked from logging in. All data is preserved.'}
            </DialogDescription>
          </DialogHeader>
          {bulkOpen === 'deactivate' && (
            <div className="grid gap-1">
              <Label htmlFor="bulk-reason">Reason *</Label>
              <Textarea id="bulk-reason" rows={3} value={bulkReason} onChange={e => setBulkReason(e.target.value)} />
            </div>
          )}
          {bulkOpen === 'delete' && (
            <div className="grid gap-1">
              <Label htmlFor="bulk-del">Type DELETE</Label>
              <Input id="bulk-del" value={bulkReason} onChange={e => setBulkReason(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={bulkLoading || (bulkOpen === 'deactivate' ? !bulkReason.trim() : bulkReason !== 'DELETE')}
              onClick={() => runBulk(bulkOpen === 'delete' ? 'delete' : 'deactivate', bulkOpen === 'delete' ? { confirmation: bulkReason } : { reason: bulkReason })}
            >
              {bulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
