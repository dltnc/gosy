import type { Payload } from 'payload'
import type { Property } from '../../payload-types'
import { PROPERTIES_INDEX, ensurePropertiesCollection, getTypesenseClient } from './typesenseClient'

export interface PropertySearchDocument {
  id: string
  name: string
  slug: string
  city: string
  localityName?: string
  propertyType: 'hotel' | 'resort'
  tier: string
  starRating?: number
  avgRating: number
  priceFrom: number
  compareAtPriceFrom?: number
  amenityIds?: string[]
  amenityNames?: string[]
  trustBadges?: string[]
  isFeatured: boolean
  featuredPriority: number
  /**
   * Epoch milliseconds, absent when no end date is recorded. Indexed so a lapsed sponsorship stops
   * winning the spotlight immediately rather than waiting for the nightly expiry job to clear
   * `isFeatured`.
   */
  featuredUntil?: number
  location?: { lat: number; lng: number }
  heroImageUrl?: string
  indexedAt: number
}

async function resolvePricingFrom(
  payload: Payload,
  propertyId: number,
): Promise<{ priceFrom: number; compareAtPriceFrom?: number }> {
  const { docs } = await payload.find({
    collection: 'room-types',
    where: {
      and: [{ property: { equals: propertyId } }, { isActive: { equals: true } }],
    },
    sort: 'basePrice',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const cheapest = docs[0]
  if (!cheapest) return { priceFrom: 0 }
  return {
    priceFrom: cheapest.basePrice ?? 0,
    compareAtPriceFrom:
      cheapest.compareAtPrice != null && cheapest.compareAtPrice > (cheapest.basePrice ?? 0)
        ? cheapest.compareAtPrice
        : undefined,
  }
}

function toEpochMs(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function buildSearchDocument(
  payload: Payload,
  property: Property,
): Promise<PropertySearchDocument | null> {
  const { priceFrom, compareAtPriceFrom } = await resolvePricingFrom(payload, property.id)

  const locality =
    typeof property.locality === 'object' && property.locality !== null
      ? property.locality.name
      : undefined

  const heroImage =
    typeof property.heroImage === 'object' && property.heroImage !== null
      ? property.heroImage.url
      : undefined

  const amenities = (property.amenities ?? []).flatMap((a) =>
    typeof a === 'object' && a !== null ? [{ id: String(a.id), name: a.name }] : [],
  )

  return {
    id: String(property.id),
    name: property.name,
    slug: property.slug,
    city: property.address?.city ?? '',
    localityName: locality || undefined,
    propertyType: property.propertyType === 'resort' ? 'resort' : 'hotel',
    tier: property.tier ?? 'standard',
    starRating: property.starRating ?? undefined,
    avgRating: property.avgRating ?? 0,
    priceFrom,
    compareAtPriceFrom,
    amenityIds: amenities.map((a) => a.id),
    amenityNames: amenities.map((a) => a.name),
    trustBadges: property.trustBadges ?? [],
    isFeatured: Boolean(property.isFeatured),
    featuredPriority: property.featuredPriority ?? 0,
    featuredUntil: toEpochMs(property.featuredUntil),
    location:
      Array.isArray(property.location) && property.location.length === 2
        ? { lat: property.location[1], lng: property.location[0] }
        : undefined,
    heroImageUrl: heroImage || undefined,
    indexedAt: Date.now(),
  }
}

export async function indexPropertyById(payload: Payload, propertyId: number): Promise<boolean> {
  const client = getTypesenseClient()
  if (!client) return false

  const property = await payload.findByID({
    collection: 'properties',
    id: propertyId,
    depth: 1,
    overrideAccess: true,
  })

  if (!property) return false

  if (property.status !== 'approved') {
    await deletePropertyFromIndex(propertyId)
    return true
  }

  const doc = await buildSearchDocument(payload, property)
  if (!doc) return false

  try {
    await ensurePropertiesCollection()
    await client.collections(PROPERTIES_INDEX).documents().upsert(doc)
    return true
  } catch (err) {
    payload.logger.error({
      msg: `Failed to index property ${propertyId} into Typesense`,
      err: err instanceof Error ? err : new Error(String(err)),
    })
    return false
  }
}

export async function deletePropertyFromIndex(propertyId: number): Promise<void> {
  const client = getTypesenseClient()
  if (!client) return

  try {
    await client.collections(PROPERTIES_INDEX).documents(String(propertyId)).delete()
  } catch {
    // 404s are expected for properties that were never indexed.
  }
}
