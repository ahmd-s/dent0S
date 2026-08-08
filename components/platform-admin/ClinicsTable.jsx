'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AccessBadge, BillingBadge, OverrideBadge, PlanBadge, StatusBadge } from './Badges'
import { fmtRelative, initials } from './format'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'trial', label: 'Trial' },
  { value: 'onboarding', label: 'Onboarding incomplete' },
]

function matchesStatus(clinic, filter) {
  switch (filter) {
    case 'active':
      return clinic.is_active && clinic.subscription_status !== 'blocked'
    case 'inactive':
      return !clinic.is_active
    case 'blocked':
      return clinic.subscription_status === 'blocked'
    case 'trial':
      return clinic.billing_status === 'trial'
    case 'onboarding':
      return !clinic.onboarding_complete
    default:
      return true
  }
}

export function ClinicsTable({ clinics }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [plan, setPlan] = useState('all')

  const planOptions = useMemo(() => {
    const set = new Set(clinics.map(c => c.plan_type).filter(Boolean))
    return Array.from(set).sort()
  }, [clinics])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clinics.filter(c => {
      if (q && !(c.name || '').toLowerCase().includes(q) && !(c.id || '').toLowerCase().includes(q)) return false
      if (!matchesStatus(c, status)) return false
      if (plan !== 'all' && (c.plan_type || '') !== plan) return false
      return true
    })
  }, [clinics, query, status, plan])

  const open = id => router.push(`/platform-admin/clinics/${id}`)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clinics by name or ID"
            className="pl-9"
            aria-label="Search clinics"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[180px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {planOptions.map(p => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-4 py-3">Clinic</TableHead>
              <TableHead className="px-4 py-3">Status</TableHead>
              <TableHead className="px-4 py-3">Plan</TableHead>
              <TableHead className="px-4 py-3">Subscription</TableHead>
              <TableHead className="px-4 py-3">Access</TableHead>
              <TableHead className="px-4 py-3 text-right">Doctors</TableHead>
              <TableHead className="px-4 py-3 text-right">Patients</TableHead>
              <TableHead className="px-4 py-3">Last activity</TableHead>
              <TableHead className="px-4 py-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-14 text-center text-sm text-muted-foreground">
                  {clinics.length === 0 ? 'No clinics yet' : 'No clinics match these filters'}
                </TableCell>
              </TableRow>
            )}
            {rows.map(c => (
              <TableRow
                key={c.id}
                onClick={() => open(c.id)}
                className="cursor-pointer"
              >
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{c.name}</div>
                      {!c.onboarding_complete && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">Onboarding incomplete</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3"><StatusBadge active={c.is_active} /></TableCell>
                <TableCell className="px-4 py-3"><PlanBadge plan={c.plan_type} /></TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <BillingBadge status={c.billing_status} />
                    <OverrideBadge status={c.platform_status} />
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3"><AccessBadge status={c.subscription_status} /></TableCell>
                <TableCell className="px-4 py-3 text-right text-muted-foreground/60">—</TableCell>
                <TableCell className="px-4 py-3 text-right text-muted-foreground/60">—</TableCell>
                <TableCell className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {fmtRelative(c.last_activity)}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={e => { e.stopPropagation(); open(c.id) }}
                  >
                    Manage
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {rows.length} of {clinics.length} clinics. Doctor and patient counts arrive in Sprint 2.
      </p>
    </div>
  )
}
