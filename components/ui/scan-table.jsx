'use client'

import { cn } from '@/lib/utils'

export default function ScanTable({ columns, children, empty }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {empty && (
        <p className="text-sm text-muted-foreground text-center py-14">{empty}</p>
      )}
    </div>
  )
}

export function ScanRow({ children, onClick }) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
    >
      {children}
    </tr>
  )
}

export function ScanCell({ children, align, muted, nowrap, className = '' }) {
  return (
    <td
      className={cn(
        'px-4 py-3.5 align-middle',
        align === 'right' ? 'text-right' : 'text-left',
        muted ? 'text-muted-foreground' : 'text-foreground',
        nowrap && 'whitespace-nowrap',
        className,
      )}
    >
      {children}
    </td>
  )
}
