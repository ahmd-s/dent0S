import { NextResponse } from 'next/server'
import { canAccessRoute } from '@/lib/rbac'

const PUBLIC_PATHS = ['/login', '/signup', '/signup/google-complete', '/forgot-password', '/reset-password', '/verify-email', '/verify-email-pending']
const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/patients', '/appointments', '/lab-cases', '/vendors', '/billing', '/settings', '/visits', '/inventory', '/subscription']

function jwtPayload(token) {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = atob(pad)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function middleware(req) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('dentos_token')?.value
  // Impersonation session takes precedence for clinic routes
  const impToken = req.cookies.get('dentos_imp')?.value
  const payload = impToken ? jwtPayload(impToken) : (token ? jwtPayload(token) : null)
  const paPayload = token ? jwtPayload(token) : null
  const isPlatformAdmin = !!paPayload?.pa
  const isImpersonating = !!payload?.imp

  if (pathname.startsWith('/book')) return NextResponse.next()
  if (pathname === '/maintenance') return NextResponse.next()
  if (pathname.startsWith('/auth/impersonate')) return NextResponse.next()

  if (pathname === '/platform-admin' || pathname.startsWith('/platform-admin/')) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    if (!isPlatformAdmin) return new NextResponse(null, { status: 404, statusText: 'Not Found' })
    return NextResponse.next()
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    if (token && !isImpersonating) {
      return NextResponse.redirect(new URL(isPlatformAdmin ? '/platform-admin' : '/dashboard', req.url))
    }
    return NextResponse.next()
  }

  if (PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    // Maintenance mode check — read from dentos_maintenance cookie set by the API
    const maintenanceCookie = req.cookies.get('dentos_maintenance')?.value
    if (maintenanceCookie === 'true' && !isPlatformAdmin) {
      return NextResponse.redirect(new URL('/maintenance', req.url))
    }

    const activeToken = impToken || token
    if (!activeToken) return NextResponse.redirect(new URL('/login', req.url))
    if (!isImpersonating && isPlatformAdmin) {
      return NextResponse.redirect(new URL('/platform-admin', req.url))
    }
    if (payload?.cid == null && !payload?.pa && !payload?.imp) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    const roles = Array.isArray(payload?.roles)
      ? payload.roles
      : payload?.role
        ? [payload.role]
        : []
    if (!canAccessRoute(roles, pathname)) {
      return NextResponse.redirect(new URL('/dashboard?error=unauthorized', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/platform-admin',
    '/platform-admin/:path*',
    '/dashboard/:path*',
    '/onboarding',
    '/login',
    '/signup',
    '/signup/google-complete',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/verify-email-pending',
    '/book/:path*',
    '/auth/impersonate',
    '/maintenance',
    '/patients/:path*',
    '/appointments/:path*',
    '/lab-cases/:path*',
    '/vendors/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/visits/:path*',
    '/inventory',
    '/inventory/:path*',
    '/subscription',
  ],
}
