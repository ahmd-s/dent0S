import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']
const AUTH_REQUIRED_PREFIXES = ['/dashboard', '/onboarding']

export function middleware(req) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('dentos_token')?.value

  if (pathname.startsWith('/book')) return NextResponse.next()

  if (PUBLIC_PATHS.includes(pathname)) {
    if (token) return NextResponse.redirect(new URL('/dashboard', req.url))
    return NextResponse.next()
  }
  if (AUTH_REQUIRED_PREFIXES.some(p => pathname.startsWith(p))) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding', '/login', '/signup', '/book/:path*'],
}
