import { describe, expect, it } from 'vitest'

import { SPOTLIGHT_LIMIT, isSponsorshipLive, splitSponsored } from '@/lib/search/sponsored'
import type { SponsoredCandidate } from '@/lib/search/sponsored'

/**
 * The paid spotlight above the organic results. Two things have to hold: a sponsorship that has
 * lapsed must lose the band before the nightly expiry job gets around to it, and a promoted listing
 * must leave the organic list so it is never shown twice or double-counted in the page total.
 */

const NOW = Date.UTC(2026, 7, 30, 12, 0, 0)
const DAY = 86_400_000

function candidate(
  overrides: Omit<Partial<SponsoredCandidate>, 'id'> & { id: number },
): SponsoredCandidate {
  return {
    isFeatured: false,
    featuredPriority: 0,
    avgRating: 0,
    ...overrides,
    id: String(overrides.id),
  }
}

describe('isSponsorshipLive', () => {
  it('ignores a property that was never sponsored', () => {
    expect(isSponsorshipLive({ isFeatured: false, featuredUntil: NOW + DAY }, NOW)).toBe(false)
  })

  it('keeps a sponsorship whose end date is still ahead', () => {
    expect(isSponsorshipLive({ isFeatured: true, featuredUntil: NOW + DAY }, NOW)).toBe(true)
  })

  it('drops a sponsorship the moment its end date passes, without waiting for the expiry job', () => {
    // `isFeatured` is still true here: the 3am job has not run yet. That is the whole point.
    expect(isSponsorshipLive({ isFeatured: true, featuredUntil: NOW - 1 }, NOW)).toBe(false)
    expect(isSponsorshipLive({ isFeatured: true, featuredUntil: NOW }, NOW)).toBe(false)
  })

  it('treats a missing or unusable end date as "no expiry recorded" rather than expired', () => {
    // Documents indexed before `featuredUntil` existed have no value; reading those as dead would
    // empty every spotlight until a full reindex.
    expect(isSponsorshipLive({ isFeatured: true }, NOW)).toBe(true)
    expect(isSponsorshipLive({ isFeatured: true, featuredUntil: undefined }, NOW)).toBe(true)
    expect(isSponsorshipLive({ isFeatured: true, featuredUntil: 0 }, NOW)).toBe(true)
    expect(isSponsorshipLive({ isFeatured: true, featuredUntil: Number.NaN }, NOW)).toBe(true)
  })
})

describe('splitSponsored', () => {
  it('returns everything as organic when nothing is sponsored', () => {
    const candidates = [candidate({ id: 1 }), candidate({ id: 2 })]
    const { spotlight, organic } = splitSponsored(candidates, { now: NOW })

    expect(spotlight).toEqual([])
    expect(organic).toEqual(candidates)
  })

  it('ranks the band by the priority the sponsor paid for, then rating, then id', () => {
    const candidates = [
      candidate({ id: 1, isFeatured: true, featuredPriority: 5, avgRating: 3 }),
      candidate({ id: 2, isFeatured: true, featuredPriority: 9, avgRating: 4 }),
      candidate({ id: 3, isFeatured: true, featuredPriority: 5, avgRating: 4.8 }),
    ]

    const { spotlight } = splitSponsored(candidates, { now: NOW })

    expect(spotlight.map((c) => c.id)).toEqual(['2', '3', '1'])
  })

  it('breaks a full tie by id so the band does not shuffle between requests', () => {
    const tie = [
      candidate({ id: 12, isFeatured: true, featuredPriority: 5, avgRating: 4 }),
      candidate({ id: 3, isFeatured: true, featuredPriority: 5, avgRating: 4 }),
    ]

    expect(splitSponsored(tie, { now: NOW }).spotlight.map((c) => c.id)).toEqual(['3', '12'])
  })

  it('caps the band at three by default and removes exactly those from the organic list', () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      candidate({ id: index + 1, isFeatured: true, featuredPriority: 10 - index }),
    )

    const { spotlight, organic } = splitSponsored(candidates, { now: NOW })

    expect(SPOTLIGHT_LIMIT).toBe(3)
    expect(spotlight.map((c) => c.id)).toEqual(['1', '2', '3'])
    expect(organic.map((c) => c.id)).toEqual(['4', '5', '6'])
  })

  it('honours a smaller limit and treats a limit of zero as "no band"', () => {
    const candidates = [
      candidate({ id: 1, isFeatured: true, featuredPriority: 2 }),
      candidate({ id: 2, isFeatured: true, featuredPriority: 1 }),
    ]

    expect(splitSponsored(candidates, { now: NOW, limit: 1 }).spotlight.map((c) => c.id)).toEqual([
      '1',
    ])

    const disabled = splitSponsored(candidates, { now: NOW, limit: 0 })
    expect(disabled.spotlight).toEqual([])
    expect(disabled.organic).toEqual(candidates)
  })

  it('leaves an expired sponsor in the organic list instead of promoting it', () => {
    const candidates = [
      candidate({ id: 1, isFeatured: true, featuredPriority: 9, featuredUntil: NOW - DAY }),
      candidate({ id: 2, isFeatured: true, featuredPriority: 1, featuredUntil: NOW + DAY }),
    ]

    const { spotlight, organic } = splitSponsored(candidates, { now: NOW })

    expect(spotlight.map((c) => c.id)).toEqual(['2'])
    expect(organic.map((c) => c.id)).toEqual(['1'])
  })

  it('preserves the shopper-chosen order of whatever stays organic', () => {
    // Candidates arrive pre-sorted by the search (price, rating, distance…). Pulling the promoted
    // ids out must not reorder the rest, or pagination would jump around.
    const candidates = [
      candidate({ id: 4 }),
      candidate({ id: 9, isFeatured: true, featuredPriority: 3 }),
      candidate({ id: 1 }),
      candidate({ id: 7 }),
    ]

    const { spotlight, organic } = splitSponsored(candidates, { now: NOW })

    expect(spotlight.map((c) => c.id)).toEqual(['9'])
    expect(organic.map((c) => c.id)).toEqual(['4', '1', '7'])
  })

  it('does not mutate the array it was handed', () => {
    const candidates = [
      candidate({ id: 1, isFeatured: true, featuredPriority: 1 }),
      candidate({ id: 2, isFeatured: true, featuredPriority: 9 }),
    ]
    const snapshot = candidates.map((c) => c.id)

    splitSponsored(candidates, { now: NOW })

    expect(candidates.map((c) => c.id)).toEqual(snapshot)
  })

  it('handles an empty candidate list', () => {
    expect(splitSponsored([], { now: NOW })).toEqual({ spotlight: [], organic: [] })
  })
})
