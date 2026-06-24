'use client'

import { useEffect } from 'react'
import Script from 'next/script'

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_ID

export default function Clarity() {
  useEffect(() => {
    // Only initialize if we have a project ID
    if (!CLARITY_PROJECT_ID) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('NEXT_PUBLIC_CLARITY_ID is not set. Clarity will not be initialized.')
      }
      return
    }

    // Initialize Clarity
    try {
      ;(function(c, l, a, r, i, t, y) {
        c[a] =
          c[a] ||
          function() {
            ;(c[a].q = c[a].q || []).push(arguments)
          }
        t = l.createElement(r)
        t.async = 1
        t.src = 'https://www.clarity.ms/tag/' + i
        y = l.getElementsByTagName(r)[0]
        y.parentNode.insertBefore(t, y)
      })(window, document, 'clarity', 'script', CLARITY_PROJECT_ID)
    } catch (error) {
      console.error('Failed to initialize Microsoft Clarity:', error)
    }
  }, [])

  // Return null since we're injecting the script via useEffect
  // This component is used for its side effect only
  return null
}
