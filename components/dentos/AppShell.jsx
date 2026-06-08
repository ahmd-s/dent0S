'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, Calendar, Receipt, Settings, LogOut, Search, Plus, Menu, X, Moon, Sun, FlaskConical, Building2, ChevronUp, CreditCard } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { ToothIcon } from './Logo'
import { useRole } from './RoleContext'
import { Badge } from '@/components/ui/badge'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

const NAV_ALL = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/lab-cases', label: 'Lab Cases', icon: FlaskConical },
  { href: '/vendors', label: 'Vendors', icon: Building2 },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings, receptionistHidden: true },
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/patients': 'Patients',
  '/appointments': 'Appointments',
  '/lab-cases': 'Lab Cases',
  '/vendors': 'Vendors',
  '/billing': 'Billing',
  '/settings': 'Settings',
}
const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : ''

function roleBadgeVariant(role) {
  if (role === 'doctor') return 'bg-teal-100 text-teal-800 hover:bg-teal-100 border-teal-200'
  if (role === 'receptionist') return 'bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200'
  if (role === 'admin') return 'bg-slate-200 text-slate-700 hover:bg-slate-200 border-slate-300'
  return 'bg-slate-100 text-slate-600'
}

function roleBadgeLabel(role) {
  if (role === 'doctor') return 'Doctor'
  if (role === 'receptionist') return 'Receptionist'
  if (role === 'admin') return 'Admin'
  return role || 'Staff'
}

export default function AppShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { me, isReceptionist } = useRole()
  const { theme, setTheme } = useTheme()
  const navItems = useMemo(() => {
    if (isReceptionist()) return NAV_ALL.filter(n => !n.receptionistHidden)
    return NAV_ALL
  }, [isReceptionist])
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const debounceRef = useRef(null)

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

  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname === k || pathname.startsWith(k+'/'))?.[1] || 'DentOS'

  return (
    <div className="min-h-screen flex bg-background">
      {mobileOpen && <div onClick={()=>setMobileOpen(false)} className="md:hidden fixed inset-0 bg-black/40 z-40"/>}
      <aside className={`w-60 sidebar-bg sidebar-fg fixed inset-y-0 left-0 flex flex-col z-50 transition-transform md:translate-x-0 ${mobileOpen?'translate-x-0':'-translate-x-full md:translate-x-0'}`}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center"><ToothIcon className="w-5 h-5 text-white"/></div>
              <div className="font-bold text-lg">DentOS</div>
            </div>
            <div className="text-xs text-[#5EEAD4] mt-1.5 truncate">{me.clinic?.name}</div>
          </div>
          <button onClick={()=>setMobileOpen(false)} className="md:hidden p-1.5 hover:bg-white/10 rounded"><X className="w-4 h-4"/></button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(n => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/')
            const Icon = n.icon
            return (
              <Link key={n.href} href={n.href} onClick={()=>setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${active?'bg-[#0D9488] text-white':'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                <Icon className="w-4 h-4"/>{n.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-white/10 relative">
          <button
            onClick={() => setProfileOpen(prev => !prev)}
            className="flex items-center gap-3 px-2 py-2 w-full hover:bg-white/5 rounded-md transition"
          >
            <div className="w-9 h-9 rounded-full bg-[#0D9488] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">{me.profile?.full_name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}</div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-medium truncate">{me.profile?.full_name}</div>
              <Badge className={`mt-1 text-[10px] px-1.5 py-0 h-5 font-semibold border capitalize ${roleBadgeVariant(me.profile?.role)}`}>
                {roleBadgeLabel(me.profile?.role)}
              </Badge>
            </div>
            <ChevronUp className={`w-4 h-4 text-white/50 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#1a2332] border border-white/10 rounded-lg overflow-hidden shadow-xl">
              <div className="px-3 py-2.5 border-b border-white/10">
                <div className="text-xs text-white/50 truncate">{me.profile?.email}</div>
              </div>
              <Link
                href="/settings?tab=subscription"
                onClick={() => { setProfileOpen(false); setMobileOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
              >
                <CreditCard className="w-4 h-4" />
                Subscription & Plan
              </Link>
              <Link
                href="/settings"
                onClick={() => { setProfileOpen(false); setMobileOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-3 px-3 py-2.5 w-full text-sm text-white/70 hover:bg-white/5 hover:text-red-400 transition"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>
      <div className="flex-1 md:ml-60">
        <header className="h-16 border-b border-border bg-background flex items-center px-4 md:px-6 sticky top-0 z-30 gap-3">
          <button onClick={()=>setMobileOpen(true)} className="md:hidden w-9 h-9 rounded-md hover:bg-muted flex items-center justify-center"><Menu className="w-5 h-5"/></button>
          <h1 className="text-lg font-bold text-foreground hidden md:block w-48">{title}</h1>
          <div className="flex-1 max-w-xl mx-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input value={q} onChange={e=>{setQ(e.target.value); setShowResults(true)}}
              onFocus={()=>setShowResults(true)} onBlur={()=>setTimeout(()=>setShowResults(false), 200)}
              placeholder="Search patients by name or phone…"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:bg-background"/>
            {showResults && q && (
              <div className="absolute top-12 left-0 right-0 bg-background border border-border rounded-md shadow-lg overflow-hidden">
                {results.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground flex items-center justify-between">
                    <span>No patient found</span>
                    {!isReceptionist() && <Link href="/patients" className="text-[#0D9488] hover:underline flex items-center gap-1"><Plus className="w-3 h-3"/>Add new</Link>}
                  </div>
                ) : results.map(p => (
                  <button key={p.id} onClick={()=>{router.push(`/patients/${p.id}`); setQ(''); setShowResults(false)}}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted border-b border-border last:border-0 flex items-center justify-between">
                    <div><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></div>
                    <div className="text-xs text-muted-foreground">{p.last_visit_date ? `Last: ${fmtDate(p.last_visit_date)}` : 'No visits'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-48 flex justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-9 h-9">
              <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <NotificationBell />
          </div>
        </header>
        <main className="p-6 bg-background min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  )
}
