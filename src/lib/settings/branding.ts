import { cache } from 'react'

import { getPayloadClient } from '../payload/getPayloadClient'

/**
 * Storefront branding, resolved from the `platform-settings` global.
 *
 * The header is a client component and the footer is a server component, so rather than each fetching
 * for itself this returns a plain serialisable object that the root layout can hand to both. Wrapped
 * in React `cache()` so the two of them share one query per render.
 *
 * Every field is optional by design: an unconfigured install renders the platform name as a text
 * wordmark, which is the behaviour the site shipped with.
 */

export interface BrandingLogo {
  url: string
  width?: number
  height?: number
}

export interface Branding {
  /** Wordmark text, and the alt text fallback. */
  siteName: string
  alt: string
  header: BrandingLogo | null
  footer: BrandingLogo | null
}

const DEFAULT_SITE_NAME = 'StayBD'

function toLogo(value: unknown): BrandingLogo | null {
  if (!value || typeof value !== 'object') return null
  const media = value as { url?: string | null; width?: number | null; height?: number | null }
  if (!media.url) return null
  return {
    url: media.url,
    ...(typeof media.width === 'number' ? { width: media.width } : {}),
    ...(typeof media.height === 'number' ? { height: media.height } : {}),
  }
}

export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const payload = await getPayloadClient()
    const settings = await payload.findGlobal({
      slug: 'platform-settings',
      // depth 1 resolves the two upload relationships to Media docs; deeper is wasted work.
      depth: 1,
      overrideAccess: true,
    })

    const siteName = settings?.platformName?.trim() || DEFAULT_SITE_NAME
    const branding = settings?.branding

    return {
      siteName,
      alt: branding?.logoAlt?.trim() || siteName,
      header: toLogo(branding?.headerLogo),
      footer: toLogo(branding?.footerLogo),
    }
  } catch {
    // Branding is chrome, not content. If the global cannot be read (cold database, migration in
    // flight) the layout should still render rather than 500 the whole site.
    return { siteName: DEFAULT_SITE_NAME, alt: DEFAULT_SITE_NAME, header: null, footer: null }
  }
})
