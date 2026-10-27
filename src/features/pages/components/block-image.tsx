import Image from 'next/image'

import type { Media } from '@/payload-types'
import { cn } from '@/lib/utils'

/**
 * The shape a page block stores for an upload: the id when the query was shallow, the document when
 * it was populated at depth 1.
 */
export type MediaRef = number | Media | null | undefined

export function mediaDoc(ref: MediaRef): Media | null {
  return typeof ref === 'object' && ref !== null && ref.url ? ref : null
}

/**
 * An image from a page block, sized by its container: every caller wraps it in a `relative` box with
 * an aspect ratio, and the image covers that box.
 *
 * `next/image` is configured for local `/api/media/file/**` paths only, so an absolute URL — what the
 * S3 adapter returns once cloud storage is switched on — is rendered with a plain `img` instead of
 * throwing in the optimiser. Same split as `SiteLogo`.
 */
export function BlockImage({
  media,
  className,
  sizes = '100vw',
  priority = false,
  fallbackAlt = '',
}: {
  media: MediaRef
  className?: string
  sizes?: string
  priority?: boolean
  fallbackAlt?: string
}) {
  const doc = mediaDoc(media)
  if (!doc?.url) return null

  const alt = doc.alt?.trim() || fallbackAlt

  if (!doc.url.startsWith('/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={doc.url}
        alt={alt}
        loading="lazy"
        className={cn('absolute inset-0 size-full object-cover', className)}
      />
    )
  }

  return (
    <Image src={doc.url} alt={alt} fill sizes={sizes} className={className} priority={priority} />
  )
}
