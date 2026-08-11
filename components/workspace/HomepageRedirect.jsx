'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useWorkspace } from './useWorkspace'

/**
 * Redirects users to their role homepage once per session on first dashboard visit.
 */
export function HomepageRedirect() {
  const pathname = usePathname()
  const router = useRouter()
  const { homepageHref, loading } = useWorkspace()
  const done = useRef(false)

  useEffect(() => {
    if (loading || done.current) return
    if (pathname !== '/dashboard') return
    if (!homepageHref || homepageHref === '/dashboard') return
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('dentos_homepage_redirected')) return

    sessionStorage.setItem('dentos_homepage_redirected', '1')
    done.current = true
    router.replace(homepageHref)
  }, [pathname, homepageHref, loading, router])

  return null
}
