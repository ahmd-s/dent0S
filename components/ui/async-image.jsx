'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Image primitive for user-uploaded content (patient photos, clinic logos,
 * document thumbnails, lab attachments).
 *
 * `next/image` is not used here: `images.unoptimized` is on because uploads are
 * already served through Cloudinary's CDN, so `next/image` would add a
 * remotePatterns allowlist and required intrinsic dimensions without optimising
 * anything. What it does provide — lazy loading, async decoding, and a stable
 * box so late-arriving images don't shift layout — is applied directly.
 *
 * Centralising it also means the eslint-disable for `no-img-element` lives in
 * one reviewed place instead of being repeated at every call site.
 */
export function AsyncImage({
  src,
  alt = '',
  className,
  fallback = null,
  eager = false,
  ...props
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) return fallback

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('bg-muted', className)}
      {...props}
    />
  )
}

export default AsyncImage
