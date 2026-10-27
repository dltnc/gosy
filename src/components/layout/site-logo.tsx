import Image from 'next/image'

import type { BrandingLogo } from '@/lib/settings/branding'

/**
 * Renders a configured logo at a fixed height, or nothing when no logo is set — callers supply the
 * text wordmark as the fallback.
 *
 * Width is derived from the stored intrinsic dimensions so the image is never distorted; when they
 * are missing (SVG uploads have no raster size) a 4:1 box is assumed, which suits a wordmark.
 *
 * `next/image` is configured for local `/api/media/file/**` paths only, so an absolute URL — what the
 * S3 adapter returns — is rendered with a plain `img` rather than crashing the optimiser.
 */
export function SiteLogo({
  logo,
  alt,
  height,
  className,
}: {
  logo: BrandingLogo | null
  alt: string
  height: number
  className?: string
}) {
  if (!logo) return null

  const ratio = logo.width && logo.height ? logo.width / logo.height : 4
  const width = Math.round(height * ratio)

  if (!logo.url.startsWith('/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo.url}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={{ height, width: 'auto' }}
      />
    )
  }

  return (
    <Image
      src={logo.url}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ height, width: 'auto' }}
      priority
    />
  )
}
