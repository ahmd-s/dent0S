'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronDown,
  Loader2,
  LogOut,
  Shield,
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
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/platform-admin', label: 'Dashboard', exact: true },
  { href: '/platform-admin/analytics', label: 'Analytics' },
  { href: '/platform-admin/monitoring', label: 'Monitoring' },
  { href: '/platform-admin/backup', label: 'Backup' },
  { href: '/platform-admin/diagnostics', label: 'Diagnostics' },
  { href: '/platform-admin/notifications', label: 'Notifications' },
  { href: '/platform-admin/broadcast', label: 'Broadcast' },
  { href: '/platform-admin/maintenance', label: 'Maintenance' },
  { href: '/platform-admin/settings', label: 'Settings' },
]

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-[#0D9488]" />
      </div>
    )
  }

  if (denied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="text-muted-foreground mt-2">This page could not be found.</p>
        <Link href="/login" className="mt-6 text-sm text-[#0D9488] hover:underline">Go to login</Link>
      </div>
    )
  }

  const isActive = (item) => {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 sm:px-8">
          {/* Brand */}
          <Link href="/platform-admin" className="flex shrink-0 items-center gap-3 mr-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-[#0D9488]" />
            </span>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-tight text-foreground">DentOS Platform</div>
              <div className="text-[10px] text-muted-foreground leading-tight">Enterprise Admin</div>
            </div>
          </Link>

          {/* Primary nav — visible on lg+ */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive(item)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile nav — dropdown */}
          <div className="flex lg:hidden flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
                  {NAV.find(isActive)?.label || 'Navigate'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {NAV.map(item => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <GlobalSearch />
            </div>
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
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  )
}
