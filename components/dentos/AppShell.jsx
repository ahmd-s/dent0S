'use client'
import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, Calendar, Receipt, Settings, LogOut, Bell, Search, Loader2, Plus } from 'lucide-react'
import { ToothIcon } from './Logo'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/patients': 'Patients',
  '/appointments': 'Appointments',
  '/billing': 'Billing',
  '/settings': 'Settings',
}
const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : ''

export default function AppShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(d => {
      if (!d?.user) { router.push('/login'); return }
      if (!d.clinic?.onboarding_complete) { router.push('/onboarding'); return }
      setMe(d)
    })
  }, [router])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      const r = await fetch(`/api/patients?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      setResults((d.patients||[]).slice(0,5))
    }, 300)
  }, [q])

  const logout = async () => { await fetch('/api/auth/logout', { method:'POST' }); router.push('/login') }

  if (!me) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0D9488]"/></div>

  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname === k || pathname.startsWith(k+'/'))?.[1] || 'DentOS'

  return (
    <div className="min-h-screen flex bg-white">
      <aside className="w-60 sidebar-bg sidebar-fg fixed inset-y-0 left-0 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center"><ToothIcon className="w-5 h-5 text-white"/></div>
            <div className="font-bold text-lg">DentOS</div>
          </div>
          <div className="text-xs text-[#5EEAD4] mt-1.5 truncate">{me.clinic?.name}</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/')
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
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#0D9488] flex items-center justify-center text-white font-semibold text-sm">{me.profile?.full_name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}</div>
            <div className="min-w-0"><div className="text-sm font-medium truncate">{me.profile?.full_name}</div><div className="text-xs text-white/50 capitalize">{me.profile?.role}</div></div>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 w-full text-sm text-white/70 hover:bg-white/5 hover:text-white rounded-md"><LogOut className="w-4 h-4"/>Sign out</button>
        </div>
      </aside>
      <div className="flex-1 ml-60">
        <header className="h-16 border-b border-border bg-white flex items-center px-6 sticky top-0 z-30">
          <h1 className="text-lg font-bold text-[#0F172A] w-48">{title}</h1>
          <div className="flex-1 max-w-xl mx-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input value={q} onChange={e=>{setQ(e.target.value); setShowResults(true)}}
              onFocus={()=>setShowResults(true)} onBlur={()=>setTimeout(()=>setShowResults(false), 200)}
              placeholder="Search patients by name or phone…"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-[#F8FAFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:bg-white"/>
            {showResults && q && (
              <div className="absolute top-12 left-0 right-0 bg-white border border-border rounded-md shadow-lg overflow-hidden">
                {results.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground flex items-center justify-between">
                    <span>No patient found</span>
                    <Link href="/patients" className="text-[#0D9488] hover:underline flex items-center gap-1"><Plus className="w-3 h-3"/>Add new</Link>
                  </div>
                ) : results.map(p => (
                  <button key={p.id} onClick={()=>{router.push(`/patients/${p.id}`); setQ(''); setShowResults(false)}}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAFC] border-b border-border last:border-0 flex items-center justify-between">
                    <div><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></div>
                    <div className="text-xs text-muted-foreground">{p.last_visit_date ? `Last: ${fmtDate(p.last_visit_date)}` : 'No visits'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-48 flex justify-end">
            <button className="w-9 h-9 rounded-md hover:bg-[#F8FAFC] flex items-center justify-center text-muted-foreground"><Bell className="w-4 h-4"/></button>
          </div>
        </header>
        <main className="p-6 bg-white min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  )
}
