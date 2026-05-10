'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, Calendar, FileText, Receipt, Settings, LogOut, Loader2 } from 'lucide-react'
import { ToothIcon } from '@/components/dentos/Logo'

const NAV = [
  { href:'/dashboard', label:'Dashboard', icon: LayoutDashboard },
  { href:'/dashboard/patients', label:'Patients', icon: Users },
  { href:'/dashboard/appointments', label:'Appointments', icon: Calendar },
  { href:'/dashboard/visits', label:'Visits', icon: FileText },
  { href:'/dashboard/invoices', label:'Invoices', icon: Receipt },
  { href:'/dashboard/settings', label:'Settings', icon: Settings },
]

export default function DashboardLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [me, setMe] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(d => {
      if (!d?.user) { router.push('/login'); return }
      if (!d.clinic?.onboarding_complete) { router.push('/onboarding'); return }
      setMe(d)
    })
  }, [router])

  const logout = async () => {
    await fetch('/api/auth/logout', { method:'POST' })
    router.push('/login')
  }

  if (!me) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  return (
    <div className="min-h-screen flex bg-white">
      <aside className="w-64 sidebar-bg sidebar-fg flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center"><ToothIcon className="w-5 h-5 text-white"/></div>
            <div><div className="font-bold text-lg leading-none">DentOS</div><div className="text-xs text-white/50 mt-1">{me.clinic?.name}</div></div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => {
            const active = pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))
            const Icon = n.icon
            return (
              <Link key={n.href} href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${active?'bg-[#0D9488] text-white':'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                <Icon className="w-4 h-4"/>{n.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-[#0D9488] flex items-center justify-center text-white font-semibold text-sm">{me.profile?.full_name?.[0]?.toUpperCase()}</div>
            <div className="min-w-0"><div className="text-sm font-medium truncate">{me.profile?.full_name}</div><div className="text-xs text-white/50 capitalize">{me.profile?.role}</div></div>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 w-full text-sm text-white/70 hover:bg-white/5 hover:text-white rounded-md"><LogOut className="w-4 h-4"/>Sign out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">{children}</main>
    </div>
  )
}
