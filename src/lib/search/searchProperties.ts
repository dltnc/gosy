import type { Payload, Where } from 'payload'
import { APIError } from 'payload'
import { PROPERTIES_INDEX, ensurePropertiesCollection, getTypesenseClient } from './typesenseClient'
import { BOOKING_ACTIVE_STATUSES } from '../bookings/statuses'
import { splitSponsored } from './sponsored'

export type { PropertySearchDocument } from './indexProperty'
import type { PropertySearchDocument } from './indexProperty'
import { buildSearchDocument } from './indexProperty'

const CANDIDATE_LIMIT = 250
const DEFAULT_PER_PAGE = 12
const MAX_PER_PAGE = 50
const DEFAULT_RADIUS_KM = 10
const MAX_RADIUS_KM = 100

export const SEARCH_SORTS = ['relevance', 'price_asc', 'price_desc', 'rating', 'distance'] as const
export type SearchSort = (typeof SEARCH_SORTS)[number]

export const PROPERTY_TYPE_VALUES = ['hotel', 'resort'] as const
export type PropertyTypeValue = (typeof PROPERTY_TYPE_VALUES)[number]

export const PROPERTY_TYPE_LABELS: Record<PropertyTypeValue, string> = {
  hotel: 'Hotels',
  resort: 'Resorts',
}

export interface SearchParams {
  q?: string
  city?: string
  locality?: string
  type: PropertyTypeValue[]
  tier: string[]
  stars?: number
  amenities: string[]
  priceMin?: number
  priceMax?: number
  checkIn?: string
  checkOut?: string
  lat?: number
  lng?: number
  radiusKm: number
  sort: SearchSort
  page: number
  perPage: number
  facets: boolean
}

export interface SearchResult {
  results: PropertySearchDocument[]
  /**
   * Paid placement for this destination, already run through the same filters and availability
   * check as `results`, and spliced out of them so nothing appears twice. Rides along inside the
   * result rather than being fetched separately so the band stays in sync with the shopper's dates
   * and filters on every refetch.
   */
  spotlight: PropertySearchDocument[]
  total: number
  page: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  facets: Record<string, Record<string, number>>
  availabilityConfirmed: boolean
  wishlistedPropertyIds?: number[]
}

function numberParam(value: string | null): number | undefined {
  if (value == null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function listParam(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function parseTypeParam(value: string | null): PropertyTypeValue[] {
  const values = listParam(value)
  if (values.length === 0) return []

  const valid = values.filter((v): v is PropertyTypeValue =>
    (PROPERTY_TYPE_VALUES as readonly string[]).includes(v),
  )
  if (valid.length !== values.length) {
    throw new APIError(`type must be one of: ${PROPERTY_TYPE_VALUES.join(', ')}.`, 400)
  }
  return valid
}

export function parseSearchParams(search: URLSearchParams): SearchParams {
  const checkIn = search.get('checkIn') ?? undefined
  const checkOut = search.get('checkOut') ?? undefined

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/
  if (checkIn && !dateOnly.test(checkIn)) throw new APIError('checkIn must be YYYY-MM-DD.', 400)
  if (checkOut && !dateOnly.test(checkOut)) throw new APIError('checkOut must be YYYY-MM-DD.', 400)
  if (checkIn && checkOut && new Date(checkOut) <= new Date(checkIn)) {
    throw new APIError('checkOut must be after checkIn.', 400)
  }

  const sortParam = (search.get('sort') ?? 'relevance') as SearchSort
  if (!SEARCH_SORTS.includes(sortParam)) {
    throw new APIError(`sort must be one of: ${SEARCH_SORTS.join(', ')}.`, 400)
  }

  const perPage = Math.min(
    Math.max(numberParam(search.get('perPage')) ?? DEFAULT_PER_PAGE, 1),
    MAX_PER_PAGE,
  )

  const radiusKm = Math.min(
    Math.max(numberParam(search.get('radiusKm')) ?? DEFAULT_RADIUS_KM, 0.5),
    MAX_RADIUS_KM,
  )

  const stars = numberParam(search.get('stars'))
  if (stars != null && (!Number.isInteger(stars) || stars < 1 || stars > 5)) {
    throw new APIError('stars must be an integer between 1 and 5.', 400)
  }

  return {
    q: search.get('q')?.trim() || undefined,
    city: search.get('city')?.trim() || undefined,
    locality: search.get('locality')?.trim() || undefined,
    type: parseTypeParam(search.get('type')),
    tier: listParam(search.get('tier')),
    stars: stars ?? undefined,
    amenities: listParam(search.get('amenities')),
    priceMin: numberParam(search.get('priceMin')),
    priceMax: numberParam(search.get('priceMax')),
    checkIn,
    checkOut,
    lat: numberParam(search.get('lat')),
    lng: numberParam(search.get('lng')),
    radiusKm,
    sort: sortParam,
    page: Math.max(numberParam(search.get('page')) ?? 1, 1),
    perPage,
    facets: search.get('facets') === '1' || search.get('facets') === 'true',
  }
}

function buildFilterBy(params: SearchParams): string {
  const filters: string[] = []

  if (params.city) filters.push(`city:=${params.city}`)
  if (params.locality) filters.push(`localityName:=${params.locality}`)
  if (params.type.length) filters.push(`propertyType:=[${params.type.join(',')}]`)
  if (params.tier.length) filters.push(`tier:=[${params.tier.join(',')}]`)
  if (params.stars != null) filters.push(`starRating:>=${params.stars}`)
  if (params.amenities.length) filters.push(`amenityIds:=[${params.amenities.join(',')}]`)
  if (params.priceMin != null) filters.push(`priceFrom:>=${params.priceMin}`)
  if (params.priceMax != null) filters.push(`priceFrom:<=${params.priceMax}`)

  if (params.lat != null && params.lng != null) {
    filters.push(`location:(${params.lat}, ${params.lng}, ${params.radiusKm} km)`)
  }

  return filters.join(' && ')
}

function buildSortBy(params: SearchParams): string | undefined {
  switch (params.sort) {
    case 'price_asc':
      return 'priceFrom:asc'
    case 'price_desc':
      return 'priceFrom:desc'
    case 'rating':
      return 'avgRating:desc,featuredPriority:desc'
    case 'distance':
      if (params.lat != null && params.lng != null) {
        return `_geo_distance(location:${params.lat},${params.lng}):asc`
      }
      return undefined
    default:
      return 'featuredPriority:desc'
  }
}

async function runPayloadFallbackSearch(
  payload: Payload,
  params: SearchParams,
): Promise<{
  hits: PropertySearchDocument[]
  facetCounts: Record<string, Record<string, number>>
}> {
  const conditions: Where[] = [{ status: { equals: 'approved' } }]
  if (params.city) conditions.push({ 'address.city': { equals: params.city } })
  if (params.q) conditions.push({ name: { like: params.q } })
  if (params.type.length) conditions.push({ propertyType: { in: params.type } })
  if (params.tier.length) conditions.push({ tier: { in: params.tier } })
  if (params.stars != null) {
    conditions.push({ starRating: { greater_than_equal: params.stars } })
  }

  const { docs } = await payload.find({
    collection: 'properties',
    where: { and: conditions },
    depth: 1,
    limit: CANDIDATE_LIMIT,
    overrideAccess: true,
  })

  const withPricing = (
    await Promise.all(docs.map((property) => buildSearchDocument(payload, property)))
  ).filter((doc): doc is PropertySearchDocument => doc !== null)

  const priceFiltered = withPricing.filter(
    (doc) =>
      (params.priceMin == null || doc.priceFrom >= params.priceMin) &&
      (params.priceMax == null || (doc.priceFrom > 0 && doc.priceFrom <= params.priceMax)),
  )

  const sorted = [...priceFiltered].sort((a, b) => {
    switch (params.sort) {
      case 'price_asc':
        return a.priceFrom - b.priceFrom
      case 'price_desc':
        return b.priceFrom - a.priceFrom
      case 'rating':
        return b.avgRating - a.avgRating || b.featuredPriority - a.featuredPriority
      default:
        return b.featuredPriority - a.featuredPriority
    }
  })

  const facetCounts: Record<string, Record<string, number>> = {}
  for (const field of ['city', 'propertyType', 'tier'] as const) {
    const counts: Record<string, number> = {}
    for (const doc of priceFiltered) {
      const value = String(doc[field] ?? '')
      if (value) counts[value] = (counts[value] ?? 0) + 1
    }
    facetCounts[field] = counts
  }

  return { hits: sorted, facetCounts }
}

async function runTypesenseSearch(
  params: SearchParams,
): Promise<{
  hits: PropertySearchDocument[]
  facetCounts: Record<string, Record<string, number>>
}> {
  const client = getTypesenseClient()
  if (!client) return { hits: [], facetCounts: {} }

  await ensurePropertiesCollection()

  const common = {
    q: params.q || '*',
    query_by: 'name,city,localityName',
    filter_by: buildFilterBy(params),
    per_page: CANDIDATE_LIMIT,
    page: 1,
  }

  const sortBy = buildSortBy(params)

  const [mainResult, facetResult] = await Promise.all([
    client
      .collections(PROPERTIES_INDEX)
      .documents()
      .search({ ...common, ...(sortBy ? { sort_by: sortBy } : {}) }),
    params.facets
      ? client
          .collections(PROPERTIES_INDEX)
          .documents()
          .search({
            ...common,
            per_page: 0,
            facet_by: 'city,propertyType,tier',
            max_facet_values: 100,
          })
      : Promise.resolve(null),
  ])

  const facetCounts: Record<string, Record<string, number>> = {}
  const facetStats = facetResult?.facet_counts ?? []
  for (const field of facetStats) {
    const counts: Record<string, number> = {}
    for (const entry of field.counts ?? []) {
      counts[entry.value] = entry.count
    }
    facetCounts[field.field_name] = counts
  }

  const hits = (mainResult.hits ?? []).map((hit) => hit.document as PropertySearchDocument)

  return { hits, facetCounts }
}

async function findAvailablePropertyIds(
  payload: Payload,
  candidateIds: number[],
  checkInDate: string,
  checkOutDate: string,
): Promise<Set<number>> {
  const roomsByProperty = new Map<number, number[]>()

  let roomPage = 1
  for (;;) {
    const { docs, hasNextPage } = await payload.find({
      collection: 'rooms',
      where: {
        and: [{ property: { in: candidateIds } }, { isActive: { equals: true } }],
      },
      limit: 500,
      page: roomPage,
      depth: 0,
      overrideAccess: true,
    })

    for (const room of docs) {
      const propertyId =
        typeof room.property === 'object' ? Number(room.property.id) : Number(room.property)
      const rooms = roomsByProperty.get(propertyId) ?? []
      rooms.push(Number(room.id))
      roomsByProperty.set(propertyId, rooms)
    }

    if (!hasNextPage) break
    roomPage++
  }

  const allRoomIds = [...roomsByProperty.values()].flat()
  if (allRoomIds.length === 0) return new Set()

  // Bookings hold one row per room, so the filter has to walk `items.room`: matching the top-level
  // `room` mirror would only ever see the first room of a multi-room booking and leave the rest
  // looking free.
  const overlapConditions: Where[] = [
    { 'items.room': { in: allRoomIds } },
    { status: { in: BOOKING_ACTIVE_STATUSES } },
    { checkInDate: { less_than: new Date(checkOutDate) } },
    { checkOutDate: { greater_than: new Date(checkInDate) } },
  ]

  const requested = new Set(allRoomIds)
  const bookedRoomIds = new Set<number>()
  let bookingPage = 1
  for (;;) {
    const { docs, hasNextPage } = await payload.find({
      collection: 'bookings',
      where: { and: overlapConditions },
      limit: 500,
      page: bookingPage,
      depth: 0,
      select: { items: true },
      overrideAccess: true,
    })

    for (const booking of docs) {
      // The query matches whole bookings, so a matched booking also carries rooms we did not ask
      // about; intersect before marking anything taken.
      for (const item of booking.items ?? []) {
        const roomId = typeof item.room === 'object' ? Number(item.room?.id) : Number(item.room)
        if (Number.isFinite(roomId) && requested.has(roomId)) bookedRoomIds.add(roomId)
      }
    }

    if (!hasNextPage) break
    bookingPage++
  }

  const available = new Set<number>()
  for (const [propertyId, roomIds] of roomsByProperty) {
    if (roomIds.some((roomId) => !bookedRoomIds.has(roomId))) {
      available.add(propertyId)
    }
  }

  return available
}

export async function getPropertySearchDocumentsByIds(
  payload: Payload,
  ids: number[],
): Promise<PropertySearchDocument[]> {
  if (ids.length === 0) return []

  const docsById = new Map<number, PropertySearchDocument>()

  const client = getTypesenseClient()
  if (client) {
    try {
      await ensurePropertiesCollection()
      const result = await client
        .collections(PROPERTIES_INDEX)
        .documents()
        .search({
          q: '*',
          query_by: 'name',
          filter_by: `id:=[${ids.join(',')}]`,
          per_page: ids.length,
        })
      for (const hit of result.hits ?? []) {
        const doc = hit.document as PropertySearchDocument
        docsById.set(Number(doc.id), doc)
      }
    } catch (err) {
      docsById.clear()
      payload.logger.error({
        msg: 'Typesense lookup by ids failed, falling back to database',
        err: err instanceof Error ? err : new Error(String(err)),
      })
    }
  }

  const missing = ids.filter((id) => !docsById.has(id))
  if (missing.length > 0) {
    const { docs } = await payload.find({
      collection: 'properties',
      where: { id: { in: missing } },
      depth: 1,
      limit: missing.length,
      overrideAccess: true,
    })
    for (const property of docs) {
      if (property.status !== 'approved') continue
      const doc = await buildSearchDocument(payload, property)
      if (doc) docsById.set(Number(property.id), doc)
    }
  }

  return ids.flatMap((id) => {
    const doc = docsById.get(id)
    return doc ? [doc] : []
  })
}

export async function searchProperties(
  payload: Payload,
  params: SearchParams,
): Promise<SearchResult> {
  const { hits, facetCounts } = getTypesenseClient()
    ? await runTypesenseSearch(params)
    : await runPayloadFallbackSearch(payload, params)

  let candidates = hits

  if (params.checkIn && params.checkOut && candidates.length > 0) {
    const candidateIds = candidates.map((hit) => Number(hit.id))
    const available = await findAvailablePropertyIds(
      payload,
      candidateIds,
      params.checkIn,
      params.checkOut,
    )
    candidates = candidates.filter((hit) => available.has(Number(hit.id)))
  }

  // The spotlight is derived from the surviving candidates, not from a separate query: availability
  // is a post-filter here, so anything picked earlier could advertise a sold-out property. Promoted
  // ids leave the organic list on every page — not just page one — so offsets stay consistent and
  // `total` counts only what the grid will actually show.
  const { spotlight, organic } = splitSponsored(candidates)

  const total = organic.length
  const totalPages = Math.max(Math.ceil(total / params.perPage), 1)
  const safePage = Math.min(params.page, totalPages)
  const start = (safePage - 1) * params.perPage
  const results = organic.slice(start, start + params.perPage)

  return {
    results,
    spotlight,
    total,
    page: safePage,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    facets: facetCounts,
    availabilityConfirmed: Boolean(params.checkIn && params.checkOut),
  }
}
