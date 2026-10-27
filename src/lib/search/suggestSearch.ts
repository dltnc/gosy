import type { Payload, Where } from 'payload'

import type { PropertySearchDocument } from './indexProperty'
import { PROPERTIES_INDEX, getTypesenseClient } from './typesenseClient'
import {
  SUGGEST_LIMIT,
  type SuggestCandidate,
  type Suggestion,
  buildSuggestions,
} from './suggestions'

/**
 * Candidate lookup for the typeahead.
 *
 * Two backends, one ranking pass. Typesense answers when it is configured — it is the only one that
 * tolerates a typo mid-word — and the database answers otherwise, because `getTypesenseClient()`
 * returns null with no env vars and a typeahead that only works in production is not much of a
 * typeahead. Both reduce to `SuggestCandidate` and hand off to `buildSuggestions`, so the order a
 * guest sees does not depend on which one ran.
 */

/** Wide enough for ranking to have something to choose from, small enough to stay keystroke-fast. */
const CANDIDATE_LIMIT = 40

export interface SuggestQuery {
  q: string
  /** Optional `hotel` / `resort` narrowing, matching the tab the guest has selected. */
  type?: string[]
}

function toCandidate(doc: PropertySearchDocument): SuggestCandidate {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    city: doc.city,
    localityName: doc.localityName,
    propertyType: doc.propertyType,
  }
}

async function typesenseCandidates(query: SuggestQuery): Promise<SuggestCandidate[] | null> {
  const client = getTypesenseClient()
  if (!client) return null

  try {
    const result = await client
      .collections(PROPERTIES_INDEX)
      .documents()
      .search({
        q: query.q,
        query_by: 'name,city,localityName',
        // Name first: someone typing a hotel name wants that hotel, not every stay in a city whose
        // name happens to contain the same word.
        query_by_weights: '3,2,1',
        prefix: true,
        num_typos: 1,
        filter_by: query.type?.length ? `propertyType:[${query.type.join(',')}]` : '',
        per_page: CANDIDATE_LIMIT,
        page: 1,
        include_fields: 'id,name,slug,city,localityName,propertyType',
      })

    return (result.hits ?? []).map((hit) => toCandidate(hit.document as PropertySearchDocument))
  } catch {
    // A search server that is unreachable should fall through to the database rather than blank the
    // widget mid-keystroke. `ensurePropertiesCollection` is deliberately not called here: a schema
    // round-trip per keystroke is the wrong trade, and a missing index lands in this branch anyway.
    return null
  }
}

async function payloadCandidates(
  payload: Payload,
  query: SuggestQuery,
): Promise<SuggestCandidate[]> {
  const conditions: Where[] = [
    { status: { equals: 'approved' } },
    {
      or: [
        { name: { like: query.q } },
        { 'address.city': { like: query.q } },
        { 'address.area': { like: query.q } },
      ],
    },
  ]
  if (query.type?.length) conditions.push({ propertyType: { in: query.type } })

  const { docs } = await payload.find({
    collection: 'properties',
    where: { and: conditions },
    limit: CANDIDATE_LIMIT,
    // depth 1 resolves `locality`, the only place a neighbourhood name lives once an author picks
    // one from the list instead of typing free text into `address.area`.
    depth: 1,
    sort: '-featuredPriority',
    overrideAccess: true,
    select: { name: true, slug: true, address: true, locality: true, propertyType: true },
  })

  return docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    slug: doc.slug ?? '',
    city: doc.address?.city ?? '',
    area: doc.address?.area,
    localityName: typeof doc.locality === 'object' && doc.locality ? doc.locality.name : undefined,
    propertyType: doc.propertyType,
  }))
}

export async function suggestSearch(payload: Payload, query: SuggestQuery): Promise<Suggestion[]> {
  const indexed = await typesenseCandidates(query)
  const candidates = indexed ?? (await payloadCandidates(payload, query))
  return buildSuggestions(candidates, query.q, SUGGEST_LIMIT)
}
