'use client'
import { Sparkles } from 'lucide-react'

export function DentosLogo({ className = '', dark = false }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${dark ? 'bg-white/15' : 'bg-[#0D9488]'}`}>
        <ToothIcon className="w-5 h-5 text-white" />
      </div>
      <span className={`text-xl font-bold tracking-tight ${dark ? 'text-white' : 'text-[#0F172A]'}`}>DentOS</span>
    </div>
  )
}

export function ToothIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2c-2 0-3 1-5 1s-3 1-3 4c0 4 2 7 2 12 0 1.5 1 3 2 3s1.5-1 2-3l1-3c0-1 .5-2 1-2s1 1 1 2l1 3c.5 2 1 3 2 3s2-1.5 2-3c0-5 2-8 2-12 0-3-1-4-3-4s-3-1-5-1z" />
    </svg>
  )
}
