'use client'
import { useState, useEffect } from 'react'
import { IndianRupee, AlertCircle } from 'lucide-react'

const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}

export default function BalanceBadge({ patientId, onClick }) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!patientId) return
    
    const fetchBalance = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/patients/outstanding-balance?patient_id=${patientId}`)
        const data = await res.json()
        if (res.ok && data.outstandingBalance > 0) {
          setBalance(data.outstandingBalance)
        } else {
          setBalance(0)
        }
      } catch (error) {
        console.error('Failed to fetch outstanding balance:', error)
        setBalance(0)
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [patientId])

  if (loading) return null
  if (!balance || balance === 0) return null

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-full border border-amber-200 transition-colors cursor-pointer"
      type="button"
    >
      <AlertCircle className="w-3.5 h-3.5" />
      <span>{formatINR(balance)} Pending</span>
    </button>
  )
}
