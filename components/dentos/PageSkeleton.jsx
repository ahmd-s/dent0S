'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function StatGridSkeleton({ count = 4, className }) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function CardSkeleton({ className }) {
  return (
    <div className={cn('rounded-lg border border-border p-6 space-y-3', className)}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

export default StatGridSkeleton
