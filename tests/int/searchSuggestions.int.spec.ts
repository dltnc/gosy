import { describe, expect, it } from 'vitest'

import {
  SUGGEST_MIN_QUERY,
  type SuggestCandidate,
  buildDestinationSuggestions,
  buildPropertySuggestions,
  buildSuggestions,
  candidateScore,
  matchRank,
  normalizeSuggestQuery,
  suggestionHref,
} from '@/lib/search/suggestions'

// The typeahead is judged on its first three rows, so ordering is the contract: a city the guest
// named outranks a stay that merely sits in it, a name match outranks a place match, and neither
// backend gets to reorder the result.

function candidate(overrides: Partial<SuggestCandidate> & { name: string }): SuggestCandidate {
  return {
    id: overrides.name,
    slug: overrides.name.toLowerCase().replace(/\s+/g, '-'),
    city: 'Dhaka',
    ...overrides,
  }
}

describe('normalizeSuggestQuery', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeSuggestQuery('  cox   bazar ')).toBe('cox bazar')
  })

  it('returns empty below the minimum length, so no request is made', () => {
    expect(normalizeSuggestQuery('d')).toBe('')
    expect(normalizeSuggestQuery('  ')).toBe('')
    expect(normalizeSuggestQuery(null)).toBe('')
    expect(normalizeSuggestQuery(undefined)).toBe('')
    expect(normalizeSuggestQuery('dh'.slice(0, SUGGEST_MIN_QUERY))).toBe('dh')
  })

  it('caps a pasted essay instead of querying on it', () => {
    expect(normalizeSuggestQuery('x'.repeat(400))).toHaveLength(60)
  })
})

describe('matchRank', () => {
  it('scores exact above prefix above word-start above mid-word', () => {
    expect(matchRank('Dhaka', 'dhaka')).toBe(4)
    expect(matchRank('Dhaka Regency', 'dhaka')).toBe(3)
    expect(matchRank("Cox's Bazar", 'bazar')).toBe(2)
    expect(matchRank('Sundarban', 'darban')).toBe(1)
  })

  it('scores a miss and an empty side as zero', () => {
    expect(matchRank('Dhaka', 'sylhet')).toBe(0)
    expect(matchRank('', 'dhaka')).toBe(0)
    expect(matchRank(null, 'dhaka')).toBe(0)
    expect(matchRank('Dhaka', '')).toBe(0)
  })
})

describe('buildDestinationSuggestions', () => {
  it('emits one row per city and drops cities that did not match', () => {
    const rows = buildDestinationSuggestions(
      [
        candidate({ name: 'A', city: 'Dhaka' }),
        candidate({ name: 'B', city: 'dhaka' }),
        candidate({ name: 'C', city: 'Sylhet' }),
      ],
      'dhaka',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'destination', label: 'Dhaka', city: 'Dhaka' })
  })

  it('breaks a rank tie on how much of the catalogue sits in the city', () => {
    const rows = buildDestinationSuggestions(
      [
        candidate({ name: 'A', city: 'Bagerhat' }),
        candidate({ name: 'B', city: 'Bandarban' }),
        candidate({ name: 'C', city: 'Bandarban' }),
      ],
      'ba',
    )
    expect(rows.map((row) => row.label)).toEqual(['Bandarban', 'Bagerhat'])
  })

  it('honours its limit and ignores a blank city', () => {
    const rows = buildDestinationSuggestions(
      [candidate({ name: 'A', city: 'Dhaka' }), candidate({ name: 'B', city: '  ' })],
      'dh',
      0,
    )
    expect(rows).toEqual([])
  })
})

describe('buildPropertySuggestions', () => {
  it('puts name matches above place matches', () => {
    const rows = buildPropertySuggestions(
      [
        candidate({ name: 'Riverside Inn', area: 'Gulshan' }),
        candidate({ name: 'Gulshan Suites', area: 'Banani' }),
      ],
      'gulshan',
    )
    expect(rows.map((row) => row.label)).toEqual(['Gulshan Suites', 'Riverside Inn'])
  })

  it('labels the row with its area and city, and never repeats the city', () => {
    const rows = buildPropertySuggestions(
      [
        candidate({ name: 'Sea Pearl', city: "Cox's Bazar", area: 'Inani' }),
        candidate({ name: 'Sea Breeze', city: "Cox's Bazar", area: "cox's bazar" }),
      ],
      'sea',
    )
    const byLabel = new Map(rows.map((row) => [row.label, row.sublabel]))
    expect(byLabel.get('Sea Pearl')).toBe("Inani, Cox's Bazar")
    expect(byLabel.get('Sea Breeze')).toBe("Cox's Bazar")
  })

  it('falls back to the locality when there is no free-text area', () => {
    const rows = buildPropertySuggestions(
      [candidate({ name: 'Lakeview', area: null, localityName: 'Dhanmondi' })],
      'lakeview',
    )
    expect(rows.map((row) => row.sublabel)).toEqual(['Dhanmondi, Dhaka'])
  })

  it('drops a row with nothing to link to', () => {
    expect(buildPropertySuggestions([candidate({ name: 'Ghost Inn', slug: '' })], 'ghost')).toEqual(
      [],
    )
  })
})

describe('candidateScore', () => {
  it('weighs the name an order above where the property sits', () => {
    const named = candidate({ name: 'Gulshan Suites', city: 'Dhaka', area: 'Banani' })
    const located = candidate({ name: 'Riverside Inn', city: 'Dhaka', area: 'Gulshan' })
    expect(candidateScore(named, 'gulshan')).toBeGreaterThan(candidateScore(located, 'gulshan'))
  })

  it('keeps a place-only match in the list rather than dropping it', () => {
    const located = candidate({ name: 'Riverside Inn', area: 'Gulshan' })
    expect(candidateScore(located, 'gulshan')).toBeGreaterThan(0)
  })

  it('scores an unrelated candidate at zero', () => {
    expect(candidateScore(candidate({ name: 'Riverside Inn' }), 'sylhet')).toBe(0)
  })
})

describe('buildSuggestions', () => {
  const dhaka = Array.from({ length: 10 }, (_, index) =>
    candidate({ name: `Stay ${index}`, id: index, city: 'Dhaka' }),
  )

  it('says nothing until the query is long enough', () => {
    expect(buildSuggestions(dhaka, 'd')).toEqual([])
    expect(buildSuggestions(dhaka, '')).toEqual([])
  })

  it('puts destinations first and honours the overall cap', () => {
    const rows = buildSuggestions(dhaka, 'dhaka')
    expect(rows).toHaveLength(8)
    expect(rows[0]?.kind).toBe('destination')
    expect(rows.slice(1).every((row) => row.kind === 'property')).toBe(true)
  })

  it('hands unused destination slots to properties rather than leaving them empty', () => {
    const rows = buildSuggestions(dhaka, 'dhaka')
    expect(rows.filter((row) => row.kind === 'destination')).toHaveLength(1)
    expect(rows.filter((row) => row.kind === 'property')).toHaveLength(7)
  })

  it('drops a document the backend returned twice', () => {
    const twice = [candidate({ name: 'Regency', id: 7 }), candidate({ name: 'Regency', id: 7 })]
    expect(buildSuggestions(twice, 'regency')).toHaveLength(1)
  })

  it('returns nothing when asked for nothing', () => {
    expect(buildSuggestions(dhaka, 'dhaka', 0)).toEqual([])
  })
})

describe('suggestionHref', () => {
  const params = new URLSearchParams({ checkIn: '2026-09-01', adults: '2' })

  it('sends a stay to its own page', () => {
    const rows = buildPropertySuggestions([candidate({ name: 'Sea Pearl' })], 'sea')
    expect(rows.map((row) => suggestionHref(row, { basePath: '/hotels-in', params }))).toEqual([
      '/property/sea-pearl?checkIn=2026-09-01&adults=2',
    ])
  })

  it('sends a destination to the city listing, encoded, and adds no empty query string', () => {
    const rows = buildDestinationSuggestions(
      [candidate({ name: 'Sea Pearl', city: "Cox's Bazar" })],
      'cox',
    )
    expect(rows.map((row) => suggestionHref(row, { basePath: '/resorts-in' }))).toEqual([
      "/resorts-in/Cox's%20Bazar",
    ])
  })
})
