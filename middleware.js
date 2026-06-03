import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']
const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/patients', '/appointments', '/lab-cases', '/vendors', '/billing', '/settings', '/visits']

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

  if (pathname.startsWith('/book')) return NextResponse.next()

  if (PUBLIC_PATHS.includes(pathname)) {
    if (token) return NextResponse.redirect(new URL('/dashboard', req.url))
    return NextResponse.next()
  }
  if (PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    const payload = jwtPayload(token)
    if (payload?.role === 'receptionist') {
      if (pathname === '/settings' || pathname.startsWith('/settings/')) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      if (pathname.startsWith('/visits')) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding', '/login', '/signup', '/book/:path*',
    '/patients/:path*', '/appointments/:path*', '/lab-cases/:path*', '/vendors/:path*', '/billing/:path*', '/settings/:path*', '/visits/:path*']
}
