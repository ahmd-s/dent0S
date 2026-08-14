import { StatGridSkeleton } from '@/components/dentos/PageSkeleton'

export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-4" aria-busy="true" aria-label="Loading">
      <StatGridSkeleton count={6} />
    </div>
  )
}
