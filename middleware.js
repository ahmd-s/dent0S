import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']
const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/patients', '/appointments', '/billing', '/settings', '/visits']

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
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding', '/login', '/signup', '/book/:path*',
    '/patients/:path*', '/appointments/:path*', '/billing/:path*', '/settings/:path*', '/visits/:path*']
}
