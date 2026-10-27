import type { Page, Property } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { buildSearchDocument } from '@/lib/search/indexProperty'
import type { PropertySearchDocument } from '@/lib/search/searchProperties'
import { PropertyCard } from '@/features/search/components/property-card'

type PropertyGrid = Extract<Page['layout'][number], { blockType: 'propertyGrid' }>

/**
 * Listings on a CMS page, read from the catalogue when the page is rendered rather than copied into
 * the page by the author — that is the point of the block. Prices come from `buildSearchDocument`, the
 * same mapping the search index uses, so a card here cannot drift from a card in search results.
 *
 * One pricing query per property, capped at 12 by the field, on a route that revalidates on a timer.
 *
 * A failed query renders nothing: a page is mostly prose and a broken grid should not 500 it.
 */
async function loadProperties(block: PropertyGrid): Promise<PropertySearchDocument[]> {
  const payload = await getPayloadClient()
  const limit = Math.min(Math.max(block.limit ?? 6, 1), 12)

  let docs: Property[] = []

  if (block.source === 'manual') {
    // Order is the author's, so the ids are resolved one by one instead of with a single `in` query.
    docs = (block.properties ?? []).flatMap((entry) =>
      typeof entry === 'object' && entry !== null && entry.status === 'approved' ? [entry] : [],
    )
  } else {
    const city = block.city?.trim()
    const found = await payload.find({
      collection: 'properties',
      where:
        block.source === 'city' && city
          ? { and: [{ status: { equals: 'approved' } }, { 'address.city': { like: city } }] }
          : { status: { equals: 'approved' } },
      sort: block.source === 'city' ? '-avgRating' : '-featuredPriority',
      limit,
      depth: 1,
      overrideAccess: true,
    })
    docs = found.docs
  }

  const documents = await Promise.all(
    docs.slice(0, limit).map((property) => buildSearchDocument(payload, property)),
  )
  return documents.flatMap((doc) => (doc ? [doc] : []))
}

export async function PropertyGridBlockView({ block }: { block: PropertyGrid }) {
  const properties = await loadProperties(block).catch(() => [])
  if (properties.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-site px-gutter py-12">
      <div className="mb-8 space-y-2">
        <h2 className="text-headline-lg">{block.heading ?? 'Stays to consider'}</h2>
        {block.subheading ? (
          <p className="text-body-lg text-muted-foreground">{block.subheading}</p>
        ) : null}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  )
}
