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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationBell } from '@/components/platform-admin/NotificationBell'
import { GlobalSearch } from '@/components/platform-admin/GlobalSearch'
import { BrandLockup } from '@/components/platform-admin/Connec8Logo'
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
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b]">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      </div>
    )
  }

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0b] px-4">
        <BrandLockup inverted subtitle="Super Admin" size={36} />
        <h1 className="mt-10 text-3xl font-semibold tracking-tight text-white">404</h1>
        <p className="mt-2 text-sm text-white/40">This page could not be found.</p>
        <Link href="/login" className="mt-6 text-sm text-white/70 hover:text-white">Go to login</Link>
      </div>
    )
  }

  const isActive = (item) => {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <div className="min-h-screen bg-[#f6f6f7]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col bg-[#0a0a0b] md:flex lg:w-[232px]">
          <Link
            href="/platform-admin"
            className="mx-3 mt-4 mb-1 rounded-xl px-2.5 py-3 transition-colors hover:bg-white/[0.04]"
          >
            <BrandLockup inverted subtitle="Super Admin" size={32} />
          </Link>
          <div className="mx-3 h-px bg-white/[0.06]" />
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <p className="mb-2 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/30">
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
                          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors',
                          active
                            ? 'bg-white/[0.08] font-medium text-white'
                            : 'text-white/55 hover:bg-white/[0.04] hover:text-white/90'
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[#2EE6D6]" />
                        )}
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-[#2EE6D6]' : 'text-white/40 group-hover:text-white/70')} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="px-5 pb-4 pt-2 text-[10px] text-white/25">Connec8</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 h-14 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
            <div className="flex h-full items-center gap-3 px-4 md:px-6">
              <Link href="/platform-admin" className="min-w-0 md:hidden">
                <BrandLockup inverted={false} subtitle="Super Admin" size={28} />
              </Link>
              <div className="flex md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-[13px] text-zinc-600">
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
              <div className="hidden min-w-0 flex-1 md:block">
                <GlobalSearch />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
                <span className="hidden max-w-[200px] truncate text-[12px] text-zinc-500 lg:inline">
                  {me?.user?.email}
                </span>
                <Button variant="ghost" size="sm" className="h-8 text-[13px] text-zinc-600" onClick={logout}>
                  <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
