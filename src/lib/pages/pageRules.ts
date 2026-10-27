/**
 * Authoring rules for CMS pages.
 *
 * Pure and dependency-free so the `pages` collection can import it (anything reaching a `server-only`
 * module would break the admin bundle) and so the rules can be unit-tested without a database.
 */

/**
 * First path segments that already belong to the app. A page saved under one of these would be
 * shadowed by the real route — Next always prefers a static segment over the `[slug]` catch-all — so
 * it is rejected at save time rather than silently becoming unreachable.
 *
 * Keep in step with the directories under `src/app/(frontend)`.
 */
export const RESERVED_PAGE_SLUGS = [
  'about',
  'admin',
  'api',
  'book',
  'booking',
  'cancellation-policy',
  'contact',
  'dashboard',
  'favicon.ico',
  'forgot-password',
  'help',
  'hotels-in',
  'images',
  'login',
  'media',
  'my-route',
  'offers',
  'partner',
  'privacy',
  'property',
  'reset-password',
  'resorts-in',
  'robots.txt',
  'signup',
  'sitemap.xml',
  'terms',
] as const

const RESERVED = new Set<string>(RESERVED_PAGE_SLUGS)

export function isReservedPageSlug(slug: string | null | undefined): boolean {
  const raw = slug?.trim().toLowerCase()
  if (!raw) return false
  // Only the first segment matters: `guides/dhaka` cannot collide with `/guides` unless `guides`
  // itself is a route, and nested slugs are how an author groups pages.
  return RESERVED.has(raw.replace(/^\/+/, '').split('/')[0])
}

/**
 * Buttons and links in blocks are author-supplied and land in an `href`, so only two shapes are
 * allowed: a site-relative path, or an absolute `https:` URL. That rules out `javascript:` (script
 * execution on click), `data:`, and protocol-relative `//host` URLs, which read as internal but are
 * not.
 */
export function isSafeHref(value: string | null | undefined): boolean {
  const raw = value?.trim()
  if (!raw) return false
  if (raw.startsWith('//')) return false
  if (raw.startsWith('/')) return true
  if (raw.startsWith('#')) return true
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'mailto:' || url.protocol === 'tel:'
  } catch {
    return false
  }
}
