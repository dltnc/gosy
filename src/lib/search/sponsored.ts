import type { PropertySearchDocument } from './indexProperty'

/**
 * Which of a search's candidates get the paid spotlight above the organic results.
 *
 * Kept pure and free of Payload/Typesense imports so it can be unit-tested: the decision "is this
 * sponsorship still live, and which three win the band" is the part that has to be right, and it
 * should not need a database to check.
 */

export const SPOTLIGHT_LIMIT = 3

/** The fields the split reads — anything shaped like this can be ranked, which keeps fixtures small. */
export type SponsoredCandidate = Pick<
  PropertySearchDocument,
  'id' | 'isFeatured' | 'featuredUntil' | 'featuredPriority' | 'avgRating'
>

/**
 * `isFeatured` alone is not enough. It is switched off by the daily `expireSubscriptions` job, so
 * between a subscription's end date and the next 3am run a lapsed sponsor would keep the band. The
 * end date rides along on the document as `featuredUntil` and is authoritative here.
 *
 * A missing or zero `featuredUntil` means "no expiry recorded" rather than "expired": documents
 * indexed before that field existed have no value, and treating those as dead would silently empty
 * every spotlight until a full reindex.
 */
export function isSponsorshipLive(
  doc: Pick<SponsoredCandidate, 'isFeatured' | 'featuredUntil'>,
  now: number = Date.now(),
): boolean {
  if (!doc.isFeatured) return false
  const until = doc.featuredUntil
  if (until == null || !Number.isFinite(until) || until <= 0) return true
  return until > now
}

/**
 * Splits already-filtered candidates into the spotlight band and the organic list beneath it.
 *
 * The spotlight is ranked by what the sponsor bought — `featuredPriority` — and not by the
 * shopper's chosen sort: a plan that promises a higher priority score should not be reordered
 * because someone switched to "price: low to high". Ties fall back to rating, then id, so the band
 * is stable between requests.
 *
 * Promoted properties are removed from `organic` so the same listing never appears twice on one
 * page, and so pagination offsets stay consistent across pages.
 */
export function splitSponsored<T extends SponsoredCandidate>(
  candidates: readonly T[],
  options: { now?: number; limit?: number } = {},
): { spotlight: T[]; organic: T[] } {
  const limit = Math.max(Math.trunc(options.limit ?? SPOTLIGHT_LIMIT), 0)
  if (limit === 0 || candidates.length === 0) {
    return { spotlight: [], organic: [...candidates] }
  }

  const now = options.now ?? Date.now()

  const spotlight = candidates
    .filter((candidate) => isSponsorshipLive(candidate, now))
    .sort(
      (a, b) =>
        b.featuredPriority - a.featuredPriority ||
        b.avgRating - a.avgRating ||
        Number(a.id) - Number(b.id),
    )
    .slice(0, limit)

  if (spotlight.length === 0) return { spotlight: [], organic: [...candidates] }

  const promoted = new Set(spotlight.map((candidate) => String(candidate.id)))
  const organic = candidates.filter((candidate) => !promoted.has(String(candidate.id)))

  return { spotlight, organic }
}
