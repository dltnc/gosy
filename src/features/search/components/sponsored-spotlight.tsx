import type { PropertySearchDocument } from '@/lib/search/searchProperties'
import { FeaturedCard } from './featured-card'
import { PropertyCard } from './property-card'

/**
 * The paid-placement band that sits above the organic results on a city listing page.
 *
 * The properties arrive already vetted by `searchProperties`: same city, same filters, same
 * availability window, live sponsorship only. This component's only job is to make the placement
 * legible as an advertisement — a bordered band, an explicit label, and a "Sponsored" badge on every
 * card — rather than letting three paid listings pass as the top of the organic ranking.
 */
export function SponsoredSpotlight({
  properties,
  wishlistedIds,
}: {
  properties: PropertySearchDocument[]
  wishlistedIds?: Set<number>
}) {
  if (properties.length === 0) return null

  const [lead, ...rest] = properties

  return (
    <section
      aria-labelledby="sponsored-spotlight-heading"
      className="space-y-5 rounded-xl border border-secondary/30 bg-secondary/5 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="sponsored-spotlight-heading" className="text-lg font-bold tracking-tight">
          {lead.city ? `Promoted stays in ${lead.city}` : 'Promoted stays'}
        </h2>
        <p className="text-xs text-muted-foreground">
          Paid placement by the property. Availability and prices are checked the same way as the
          results below.
        </p>
      </div>

      <FeaturedCard property={lead} label="Sponsored" />

      {rest.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {rest.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              sponsored
              wishlisted={wishlistedIds?.has(Number(property.id))}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
