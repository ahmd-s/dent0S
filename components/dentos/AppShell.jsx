'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Search, Plus, Menu, X, Moon, Sun, ChevronUp, CreditCard, Settings } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { ClinicLogo } from './Logo'
import { useRole } from './RoleContext'
import { useWorkspace } from '@/components/workspace/useWorkspace'
import WorkspaceGate from '@/components/workspace/WorkspaceGate'
import { Badge } from '@/components/ui/badge'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { canAccessRoute, canAccessSettings } from '@/lib/rbac'
import { getProfileRoles, roleBadgeLabel } from '@/lib/profile-roles'
import { NAV_REGISTRY } from '@/lib/workspace-nav-registry'
import { CLINIC_ACCESS_PAUSED_MESSAGE } from '@/lib/clinic-access'
import { ImpersonationBanner } from '@/components/platform-admin/ImpersonationBanner'

const INVENTORY_SUBNAV = [
  { href: '/inventory', label: 'Dashboard' },
  { href: '/inventory/items', label: 'Items' },
  { href: '/inventory/templates', label: 'Templates' },
  { href: '/inventory/movements', label: 'Movements' },
  { href: '/inventory/alerts', label: 'Alerts' },
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/patients': 'Patients',
  '/appointments': 'Appointments',
  '/visits': 'Visits',
  '/lab-cases': 'Lab Cases',
  '/vendors': 'Vendors',
  '/inventory': 'Inventory',
  '/billing': 'Billing',
  '/reports': 'Reports',
  '/settings': 'Settings',
}
const fmtDate = d => d ? `${String(new Date(d).getDate()).padStart(2,'0')}/${String(new Date(d).getMonth()+1).padStart(2,'0')}/${new Date(d).getFullYear()}` : ''

function roleBadgeVariant(roles) {
  const list = getProfileRoles(roles)
  if (list.includes('admin')) return 'bg-slate-200 text-slate-700 hover:bg-slate-200 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
  if (list.includes('doctor')) return 'bg-teal-100 text-teal-800 hover:bg-teal-100 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800'
  if (list.includes('receptionist')) return 'bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
}

export default function AppShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { me, roles } = useRole()
  const { navigationOrder, layoutClasses } = useWorkspace()
  const { theme, setTheme } = useTheme()
  const navItems = useMemo(() => {
    return navigationOrder
      .map(key => {
        const reg = NAV_REGISTRY[key]
        if (!reg) return null
        return { key, href: reg.href, label: reg.label, icon: reg.icon }
      })
      .filter(Boolean)
      .filter(n => canAccessRoute(roles, n.href))
  }, [navigationOrder, roles])
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
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

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/login')
  }

  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname === k || pathname.startsWith(k+'/'))?.[1] || 'DentOS'

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      {me?.is_impersonating && (
        <ImpersonationBanner
          clinicName={me.impersonated_clinic_name || me.clinic?.name}
          byEmail={me.impersonated_by_email}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
      {mobileOpen && <div onClick={()=>setMobileOpen(false)} className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"/>}
      <aside className={`w-64 lg:w-72 sidebar-bg sidebar-fg fixed inset-y-0 left-0 flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${mobileOpen?'translate-x-0':'-translate-x-full md:translate-x-0'}`}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClinicLogo logoUrl={me.clinic?.logo_url} />
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
              <div key={n.key}>
                <Link href={n.href} onClick={()=>setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${active?'bg-[#0D9488] text-white':'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                  <Icon className="w-4 h-4"/>{n.label}
                </Link>
                {n.href === '/inventory' && pathname.startsWith('/inventory') && (
                  <div className="ml-3 mt-1 space-y-0.5 border-l border-white/20 pl-3">
                    {INVENTORY_SUBNAV.map(sub => {
                      const subActive = pathname === sub.href
                      return (
                        <Link key={sub.href} href={sub.href} onClick={()=>setMobileOpen(false)}
                          className={`block pl-9 py-1.5 text-xs font-medium rounded-md transition ${subActive?'text-white bg-white/10':'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
                          {sub.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
              <Badge className={`mt-1 text-[10px] px-1.5 py-0 h-5 font-semibold border ${roleBadgeVariant(me.profile)}`}>
                {roleBadgeLabel(me.profile)}
              </Badge>
            </div>
            <ChevronUp className={`w-4 h-4 text-white/50 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#1a2332] border border-white/10 rounded-lg overflow-hidden shadow-xl">
              <div className="px-3 py-2.5 border-b border-white/10">
                <div className="text-xs text-white/50 truncate">{me.profile?.email}</div>
              </div>
              {canAccessSettings(me.profile) && (
              <WorkspaceGate module="subscription">
              <Link
                href="/subscription"
                onClick={() => { setProfileOpen(false); setMobileOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
              >
                <CreditCard className="w-4 h-4" />
                Subscription & Plan
              </Link>
              </WorkspaceGate>
              )}
              <WorkspaceGate module="settings">
              <Link
                href="/settings"
                onClick={() => { setProfileOpen(false); setMobileOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              </WorkspaceGate>
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
      <div className="flex-1 md:ml-64 lg:ml-72 min-w-0">
        <header className="h-16 border-b border-border bg-background flex items-center px-3 md:px-6 sticky top-0 z-30 gap-2 md:gap-3">
          <button onClick={()=>setMobileOpen(true)} className="md:hidden w-10 h-10 rounded-md hover:bg-muted flex items-center justify-center touch-manipulation"><Menu className="w-5 h-5"/></button>
          <h1 className="text-base md:text-lg font-bold text-foreground hidden md:block w-48 truncate">{title}</h1>
          
          {/* Mobile Search Toggle */}
          <button 
            onClick={()=>setSearchExpanded(!searchExpanded)}
            className="md:hidden w-10 h-10 rounded-md hover:bg-muted flex items-center justify-center touch-manipulation"
          >
            <Search className="w-5 h-5"/>
          </button>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-xl mx-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input value={q} onChange={e=>{setQ(e.target.value); setShowResults(true)}}
              onFocus={()=>setShowResults(true)} onBlur={()=>setTimeout(()=>setShowResults(false), 200)}
              placeholder="Search patients by name or phone…"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:bg-background"/>
            {showResults && q && (
              <div className="absolute top-12 left-0 right-0 bg-background border border-border rounded-md shadow-lg overflow-hidden z-50">
                {results.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground flex items-center justify-between">
                    <span>No patient found</span>
                    {canAccessRoute(roles, '/patients') && <Link href="/patients" className="text-[#0D9488] hover:underline flex items-center gap-1"><Plus className="w-3 h-3"/>Add new</Link>}
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

          {/* Action Buttons */}
          <div className="flex items-center gap-1 md:gap-2 ml-auto">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-9 h-9 md:w-9 md:h-9 touch-manipulation">
              <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <WorkspaceGate section="dashboard" flag="notifications">
            <NotificationBell />
            </WorkspaceGate>
          </div>
        </header>

        {/* Mobile Expanded Search */}
        {searchExpanded && (
          <div className="md:hidden px-3 py-3 bg-background border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input value={q} onChange={e=>{setQ(e.target.value); setShowResults(true)}}
                onFocus={()=>setShowResults(true)} onBlur={()=>setTimeout(()=>setShowResults(false), 200)}
                placeholder="Search patients by name or phone…"
                className="w-full h-11 pl-9 pr-3 rounded-md border border-input bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:bg-background"/>
              {showResults && q && (
                <div className="absolute top-12 left-0 right-0 bg-background border border-border rounded-md shadow-lg overflow-hidden z-50">
                  {results.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground flex items-center justify-between">
                      <span>No patient found</span>
                      {canAccessRoute(roles, '/patients') && <Link href="/patients" className="text-[#0D9488] hover:underline flex items-center gap-1"><Plus className="w-3 h-3"/>Add new</Link>}
                    </div>
                  ) : results.map(p => (
                    <button key={p.id} onClick={()=>{router.push(`/patients/${p.id}`); setQ(''); setShowResults(false); setSearchExpanded(false)}}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted border-b border-border last:border-0 flex items-center justify-between">
                      <div><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-muted-foreground">+91 {p.phone}</div></div>
                      <div className="text-xs text-muted-foreground">{p.last_visit_date ? `Last: ${fmtDate(p.last_visit_date)}` : 'No visits'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {me.clinic?.subscription_status === 'blocked' && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 text-sm dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100">
            {CLINIC_ACCESS_PAUSED_MESSAGE}
          </div>
        )}

        {me.clinic?.subscription_status !== 'blocked' && me.subscription_hint?.show_trial_warning && (
          <div className="bg-sky-50 border-b border-sky-200 text-sky-900 px-4 py-3 text-sm dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-100 flex flex-wrap items-center gap-2 justify-between">
            <span>
              Your trial ends in {me.subscription_hint.trial_days_remaining} day{me.subscription_hint.trial_days_remaining === 1 ? '' : 's'} — please subscribe to continue.
            </span>
            <Link href="/subscription" className="font-medium text-[#0D9488] hover:underline shrink-0">
              View plans
            </Link>
          </div>
        )}

        <main className={cn('p-4 md:p-6 bg-background min-h-[calc(100vh-4rem)] overflow-x-hidden', layoutClasses)}>{children}</main>
      </div>
      </div>
    </div>
  )
}
