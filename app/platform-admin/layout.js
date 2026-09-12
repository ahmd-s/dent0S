'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  HardDrive,
  HeartPulse,
  Loader2,
  LogOut,
  Megaphone,
  Settings,
  Stethoscope,
  UserPlus,
  Wallet,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationBell } from '@/components/platform-admin/NotificationBell'
import { GlobalSearch } from '@/components/platform-admin/GlobalSearch'
import { Connec8Logo } from '@/components/platform-admin/Connec8Logo'
import { cn } from '@/lib/utils'

const NAV_GROUPS = [
  {
    label: 'Operate',
    items: [
      { href: '/platform-admin', label: 'Dashboard', icon: Activity, exact: true },
      { href: '/platform-admin/clinics', label: 'Clinics', icon: Building2 },
      { href: '/platform-admin/leads', label: 'Leads', icon: UserPlus },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/platform-admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/platform-admin/razorpay', label: 'Razorpay', icon: Wallet },
      { href: '/platform-admin/health', label: 'System Health', icon: HeartPulse },
      { href: '/platform-admin/monitoring', label: 'Monitoring', icon: Stethoscope },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/platform-admin/backup', label: 'Backup', icon: HardDrive },
      { href: '/platform-admin/diagnostics', label: 'Diagnostics', icon: Wrench },
      { href: '/platform-admin/notifications', label: 'Notifications', icon: Bell },
      { href: '/platform-admin/broadcast', label: 'Broadcast', icon: Megaphone },
      { href: '/platform-admin/maintenance', label: 'Maintenance', icon: Wrench },
      { href: '/platform-admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const FLAT_NAV = NAV_GROUPS.flatMap(g => g.items)

export default function PlatformAdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState(null)
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/auth/me')
        const d = await r.json()
        if (cancelled) return
        if (!d?.user || !d.is_platform_admin) {
          setDenied(true)
          setLoading(false)
          return
        }
        if (!d.platform_session_active) {
          await fetch('/api/auth/logout', { method: 'POST' })
          router.push('/login')
          return
        }
        setMe(d)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setDenied(true)
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [router])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070a]">
        <Loader2 className="h-6 w-6 animate-spin text-[#2EE6D6]" />
      </div>
    )
  }

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07070a] px-4">
        <Connec8Logo variant="full" className="mb-6 w-40" />
        <h1 className="text-4xl font-bold text-white">404</h1>
        <p className="mt-2 text-white/50">This page could not be found.</p>
        <Link href="/login" className="mt-6 text-sm text-[#2EE6D6] hover:underline">Go to login</Link>
      </div>
    )
  }

  const isActive = (item) => {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-[#07070a] px-3 py-4 lg:flex">
          <Link href="/platform-admin" className="mb-6 block px-1">
            <Connec8Logo variant="full" />
            <p className="mt-2 px-1 text-[10px] font-medium tracking-wide text-white/40">DentOS Super Admin</p>
          </Link>
          <nav className="flex-1 space-y-5 overflow-y-auto">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon
                    const active = isActive(item)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors',
                          active
                            ? 'bg-white/10 font-medium text-white'
                            : 'text-white/55 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <Link href="/platform-admin" className="flex shrink-0 items-center gap-2 lg:hidden">
                <Connec8Logo />
              </Link>
              <div className="flex lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
                      {FLAT_NAV.find(isActive)?.label || 'Navigate'}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    {FLAT_NAV.map(item => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href}>{item.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="hidden flex-1 md:block">
                <GlobalSearch />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
                <Badge variant="outline" className="hidden font-normal text-muted-foreground xl:inline-flex text-xs">
                  {me?.user?.email}
                </Badge>
                <Button variant="outline" size="sm" onClick={logout}>
                  <LogOut className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
