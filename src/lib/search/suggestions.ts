/**
 * Ranking and shaping for the search typeahead.
 *
 * Pure and dependency-free on purpose: the same functions rank Typesense hits and Payload fallback
 * rows, so the two backends cannot disagree about ordering, and the client component can import
 * them without pulling server modules into the browser bundle.
 *
 * Destinations are cities only. A locality is not offered as its own row because the city listing
 * page has no locality filter to send one to — such a row would quietly show the whole city
 * instead. Localities still reach a guest through the properties inside them: typing `Gulshan`
 * matches a property's area and the row reads "Gulshan, Dhaka".
 */

/** Below this, a query matches most of the catalogue, so the widget stays quiet instead. */
export const SUGGEST_MIN_QUERY = 2
export const SUGGEST_LIMIT = 8
/** Ceiling, not a quota: unused destination slots are handed to properties. */
export const SUGGEST_DESTINATIONS = 4
const SUGGEST_QUERY_MAX = 60

export type SuggestionKind = 'destination' | 'property'

export interface Suggestion {
  kind: SuggestionKind
  /** Stable within one response; used as the React key and the `aria-activedescendant` target. */
  id: string
  label: string
  sublabel?: string
  /** The city to search when this row is picked — set for both kinds. */
  city: string
  /** Present only for `property`, and the reason a property row can link straight to its page. */
  slug?: string
  propertyType?: string
}

/** The shape both backends reduce to before ranking. */
export interface SuggestCandidate {
  id: number | string
  name: string
  slug: string
  city: string
  area?: string | null
  localityName?: string | null
  propertyType?: string | null
}

/**
 * Cleans what the guest typed and gates it: an empty string means "do not ask the server". Both the
 * endpoint and the client call this, so the fetch threshold and the server threshold are the same
 * number and a request can never be too short to be useful.
 */
export function normalizeSuggestQuery(raw: string | null | undefined): string {
  const collapsed = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, SUGGEST_QUERY_MAX)
  return collapsed.length >= SUGGEST_MIN_QUERY ? collapsed : ''
}

/**
 * How well `needle` matches `haystack`, from 0 (not at all) to 4 (identical). The gradient is what
 * puts "Dhaka" above "Bay View Dhaka Annexe" when someone types "dha", and a match that begins a
 * later word above one buried inside a word.
 */
export function matchRank(haystack: string | null | undefined, needle: string): number {
  const hay = (haystack ?? '').trim().toLowerCase()
  const pin = needle.trim().toLowerCase()
  if (!hay || !pin) return 0
  if (hay === pin) return 4

  const at = hay.indexOf(pin)
  if (at < 0) return 0
  if (at === 0) return 3
  return /[\s,'’\-/&(]/.test(hay[at - 1]) ? 2 : 1
}

/**
 * A property's score. The name is weighted an order of magnitude above where it is, so a hotel
 * called "Gulshan Suites" outranks an unrelated hotel that merely sits in Gulshan — while a
 * place-only match still scores above zero and stays in the list.
 */
export function candidateScore(candidate: SuggestCandidate, query: string): number {
  const place = Math.max(
    matchRank(candidate.area, query),
    matchRank(candidate.localityName, query),
    matchRank(candidate.city, query),
  )
  return matchRank(candidate.name, query) * 10 + place
}

/**
 * One row per distinct city, ordered by how well the name matches and then by how much of the
 * catalogue sits there.
 */
export function buildDestinationSuggestions(
  candidates: SuggestCandidate[],
  query: string,
  limit = SUGGEST_DESTINATIONS,
): Suggestion[] {
  const cities = new Map<string, { city: string; rank: number; weight: number }>()

  for (const candidate of candidates) {
    const city = candidate.city?.trim()
    if (!city) continue
    const rank = matchRank(city, query)
    if (rank === 0) continue

    const key = city.toLowerCase()
    const seen = cities.get(key)
    if (seen) seen.weight += 1
    else cities.set(key, { city, rank, weight: 1 })
  }

  return [...cities.values()]
    .sort((a, b) => b.rank - a.rank || b.weight - a.weight || a.city.localeCompare(b.city))
    .slice(0, Math.max(limit, 0))
    .map(({ city }) => ({
      kind: 'destination',
      id: `destination:${city.toLowerCase()}`,
      label: city,
      sublabel: 'Destination',
      city,
    }))
}

function placeLabel(candidate: SuggestCandidate): string {
  const city = candidate.city?.trim() ?? ''
  const place = candidate.area?.trim() || candidate.localityName?.trim() || ''
  if (!place || place.toLowerCase() === city.toLowerCase()) return city
  return city ? `${place}, ${city}` : place
}

/** Named stays, best name match first. A row without a slug is dropped: it has nowhere to link. */
export function buildPropertySuggestions(
  candidates: SuggestCandidate[],
  query: string,
  limit = SUGGEST_LIMIT,
): Suggestion[] {
  return candidates
    .map((candidate) => ({ candidate, score: candidateScore(candidate, query) }))
    .filter((entry) => entry.score > 0 && Boolean(entry.candidate.slug?.trim()))
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, Math.max(limit, 0))
    .map(({ candidate }) => ({
      kind: 'property',
      id: `property:${candidate.id}`,
      label: candidate.name,
      sublabel: placeLabel(candidate),
      city: candidate.city?.trim() ?? '',
      slug: candidate.slug.trim(),
      propertyType: candidate.propertyType ?? undefined,
    }))
}

/**
 * The whole list, destinations above stays. `SUGGEST_DESTINATIONS` is a ceiling rather than a
 * reservation: when a query matches one city, the other slots go to properties instead of sitting
 * empty.
 */
export function buildSuggestions(
  candidates: SuggestCandidate[],
  query: string,
  limit = SUGGEST_LIMIT,
): Suggestion[] {
  const clean = normalizeSuggestQuery(query)
  const cap = Math.max(limit, 0)
  if (!clean || cap === 0) return []

  const destinations = buildDestinationSuggestions(
    candidates,
    clean,
    Math.min(SUGGEST_DESTINATIONS, cap),
  )
  const properties = buildPropertySuggestions(candidates, clean, cap - destinations.length)

  // A backend can repeat a document across pages; ids are the last word on identity.
  const seen = new Set<string>()
  return [...destinations, ...properties].filter((suggestion) => {
    if (seen.has(suggestion.id)) return false
    seen.add(suggestion.id)
    return true
  })
}

/**
 * Where a picked row goes. A property links straight to its own page — that is the point of
 * searching by name — while a destination keeps the existing city-listing path, so the widget adds
 * a shortcut without changing what the form already does.
 */
export function suggestionHref(
  suggestion: Suggestion,
  options: { basePath: string; params?: URLSearchParams | string },
): string {
  const query = options.params ? String(options.params) : ''
  const suffix = query ? `?${query}` : ''

  if (suggestion.kind === 'property' && suggestion.slug) {
    return `/property/${encodeURIComponent(suggestion.slug)}${suffix}`
  }
  return `${options.basePath}/${encodeURIComponent(suggestion.city)}${suffix}`
}
