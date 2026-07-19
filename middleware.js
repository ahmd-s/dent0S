import { NextResponse } from 'next/server'
import { canAccessRoute } from '@/lib/rbac'

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/verify-email-pending']
const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/patients', '/appointments', '/lab-cases', '/vendors', '/billing', '/settings', '/visits', '/inventory']

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
  const payload = token ? jwtPayload(token) : null
  const isPlatformAdmin = !!payload?.pa

  if (pathname.startsWith('/book')) return NextResponse.next()

  if (pathname === '/platform-admin' || pathname.startsWith('/platform-admin/')) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    if (!isPlatformAdmin) return new NextResponse(null, { status: 404, statusText: 'Not Found' })
    return NextResponse.next()
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL(isPlatformAdmin ? '/platform-admin' : '/dashboard', req.url))
    }
    return NextResponse.next()
  }

  if (PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    if (isPlatformAdmin) return NextResponse.redirect(new URL('/platform-admin', req.url))
    if (!canAccessRoute(payload?.role, pathname)) {
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
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/verify-email-pending',
    '/book/:path*',
    '/patients/:path*',
    '/appointments/:path*',
    '/lab-cases/:path*',
    '/vendors/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/visits/:path*',
    '/inventory',
    '/inventory/:path*',
  ],
}
