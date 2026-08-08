'use client'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge, ToneBadge } from './Badges'
import { fmtDate, initials } from './format'

function severity(days) {
  if (days == null) return 'red'
  if (days >= 60) return 'red'
  if (days >= 30) return 'amber'
  return 'slate'
}

export function UsageHealthTable({ clinics, cutoffDate }) {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-4 py-3">Clinic</TableHead>
              <TableHead className="px-4 py-3">Clinic status</TableHead>
              <TableHead className="px-4 py-3">Last visit</TableHead>
              <TableHead className="px-4 py-3 text-right">Days since visit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="py-14 text-center text-sm text-muted-foreground">
                  All clinics have recent visit activity
                </TableCell>
              </TableRow>
            )}
            {clinics.map(c => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => router.push(`/platform-admin/clinics/${c.id}`)}
              >
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(c.name)}
                    </span>
                    <span className="font-medium text-foreground">{c.name}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3"><StatusBadge active={c.is_active} /></TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">{fmtDate(c.last_visit_date)}</TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <ToneBadge tone={severity(c.days_since_last_visit)}>
                    {c.days_since_last_visit ?? 'Never'}
                  </ToneBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {cutoffDate && (
        <p className="text-xs text-muted-foreground">No visits recorded since {fmtDate(cutoffDate)}.</p>
      )}
    </div>
  )
}
