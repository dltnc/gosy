import { describe, expect, it } from 'vitest'

import { RESERVED_PAGE_SLUGS, isReservedPageSlug, isSafeHref } from '@/lib/pages/pageRules'

// Both rules guard author input on a public page: a reserved slug produces a page nobody can reach,
// and an unchecked href puts whatever was typed into an anchor, so the rejection cases are the point.

describe('isReservedPageSlug', () => {
  it('rejects a slug that shadows a real route', () => {
    for (const slug of ['about', 'offers', 'partner', 'admin', 'api', 'property', 'sitemap.xml']) {
      expect(isReservedPageSlug(slug)).toBe(true)
    }
  })

  it('rejects a reserved first segment even when the page is nested under it', () => {
    expect(isReservedPageSlug('offers/eid')).toBe(true)
    expect(isReservedPageSlug('property/anything/deeper')).toBe(true)
  })

  it('ignores case, surrounding whitespace and a leading slash', () => {
    expect(isReservedPageSlug('  /About  ')).toBe(true)
    expect(isReservedPageSlug('OFFERS')).toBe(true)
  })

  it('allows anything that is not a route', () => {
    for (const slug of [
      'about-us',
      'guides',
      'guides/dhaka',
      'offers-2026',
      'travel-partners',
      'aboutx',
    ]) {
      expect(isReservedPageSlug(slug)).toBe(false)
    }
  })

  it('treats an empty slug as not reserved — the field rule reports that separately', () => {
    expect(isReservedPageSlug('')).toBe(false)
    expect(isReservedPageSlug('   ')).toBe(false)
    expect(isReservedPageSlug(null)).toBe(false)
    expect(isReservedPageSlug(undefined)).toBe(false)
  })

  it('keeps the list sorted and free of duplicates so it can be scanned by eye', () => {
    const list = [...RESERVED_PAGE_SLUGS]
    expect(list).toEqual([...list].sort())
    expect(new Set(list).size).toBe(list.length)
  })
})

describe('isSafeHref', () => {
  it('accepts a site-relative path', () => {
    expect(isSafeHref('/offers')).toBe(true)
    expect(isSafeHref('/hotels-in/dhaka?sort=price')).toBe(true)
    expect(isSafeHref('  /about  ')).toBe(true)
  })

  it('accepts an in-page anchor', () => {
    expect(isSafeHref('#rooms')).toBe(true)
  })

  it('accepts absolute https, mail and phone links', () => {
    expect(isSafeHref('https://example.com/page')).toBe(true)
    expect(isSafeHref('mailto:hello@staybd.test')).toBe(true)
    expect(isSafeHref('tel:+8801700000000')).toBe(true)
  })

  it('rejects script execution and data URLs', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false)
    expect(isSafeHref('JavaScript:alert(1)')).toBe(false)
    expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false)
  })

  it('rejects protocol-relative URLs, which read as internal but are not', () => {
    expect(isSafeHref('//evil.test/offers')).toBe(false)
  })

  it('rejects http, which would downgrade the connection', () => {
    expect(isSafeHref('http://example.com')).toBe(false)
  })

  it('rejects anything that is neither a path nor a URL', () => {
    expect(isSafeHref('example.com')).toBe(false)
    expect(isSafeHref('offers')).toBe(false)
    expect(isSafeHref('')).toBe(false)
    expect(isSafeHref('   ')).toBe(false)
    expect(isSafeHref(null)).toBe(false)
    expect(isSafeHref(undefined)).toBe(false)
  })
})
