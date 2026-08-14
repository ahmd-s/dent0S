'use client'
import { memo, useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { getOutstandingBalance } from '@/lib/outstanding-balance-client'

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/**
 * Rendered once per row in appointment queues and search results, so the
 * lookup goes through a batching client rather than firing its own request.
 */
function BalanceBadge({ patientId, onClick }) {
  const [balance, setBalance] = useState(null)

  useEffect(() => {
    if (!patientId) return
    let ignore = false
    getOutstandingBalance(patientId).then(value => {
      if (!ignore) setBalance(value)
    })
    return () => { ignore = true }
  }, [patientId])

  if (!balance) return null

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-full border border-amber-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
      type="button"
      aria-label={`Outstanding balance ${inrFormatter.format(balance)}. View details.`}
    >
      <AlertCircle className="w-3.5 h-3.5" aria-hidden />
      <span>{inrFormatter.format(balance)} Pending</span>
    </button>
  )
}

export default memo(BalanceBadge)
