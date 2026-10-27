import { Suspense } from 'react'
import { headers as getHeaders } from 'next/headers'

import { FiltersPanel } from '@/features/search/components/filters-panel'
import { ResultsSection } from '@/features/search/components/results-section'
import { SearchBar } from '@/features/search/components/search-bar'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { getWishlistedPropertyIds } from '@/lib/wishlist'
import {
  listingSearchParams,
  parseListingSearch,
} from '@/lib/search-params/listing'
import {
  parseSearchParams,
  searchProperties,
  PROPERTY_TYPE_LABELS,
  type PropertyTypeValue,
  type SearchResult,
} from '@/lib/search/searchProperties'

interface CityListingPageProps {
  city: string
  propertyType: PropertyTypeValue
  rawSearch: Record<string, string | string[] | undefined>
}

export async function CityListingPage({
  city,
  propertyType,
  rawSearch,
}: CityListingPageProps) {
  const cityName = decodeURIComponent(city)
  const label = PROPERTY_TYPE_LABELS[propertyType]

  const parsed = parseListingSearch(rawSearch)

  if (!parsed.ok) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">
          {label} in {cityName}
        </h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {parsed.error}
        </div>
      </div>
    )
  }

  const payload = await getPayloadClient()

  const [amenitiesResult, initialData] = await Promise.all([
    payload.find({
      collection: 'amenities',
      limit: 50,
      depth: 0,
      overrideAccess: true,
      select: { name: true },
    }),
    (async (): Promise<SearchResult | undefined> => {
      try {
        const urlParams = listingSearchParams(parsed.data)
        urlParams.set('city', cityName)
        urlParams.set('type', propertyType)
        const searchParamsInput = parseSearchParams(urlParams)
        return await searchProperties(payload, searchParamsInput)
      } catch {
        return undefined
      }
    })(),
  ])

  const amenities = amenitiesResult.docs.map((amenity) => ({
    id: String(amenity.id),
    label: amenity.name,
  }))

  if (initialData) {
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })
    if (user) {
      try {
        const wishlisted = await getWishlistedPropertyIds(payload, user.id)
        initialData.wishlistedPropertyIds = [...wishlisted]
      } catch {
        // initial data stays valid without wishlist annotations
      }
    }
  }

  return (
    <div className="mx-auto max-w-site px-gutter py-6">
      <Suspense>
        <SearchBar initialCity={cityName} initialPropertyType={propertyType} submitLabel="Update" />
      </Suspense>

      <div className="mt-4 mb-5">
        <p className="text-sm text-muted-foreground">
          {parsed.data.checkIn && parsed.data.checkOut
            ? `${parsed.data.checkIn} → ${parsed.data.checkOut} · ${parsed.data.adults} guest${parsed.data.adults === 1 ? '' : 's'}`
            : 'Prices shown are lowest available — pick dates for live availability.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Suspense>
          <FiltersPanel filters={parsed.data} amenities={amenities} />
        </Suspense>

        <Suspense>
          <ResultsSection
            city={city}
            title={`${label} in ${cityName}`}
            propertyType={propertyType}
            initialData={initialData}
          />
        </Suspense>
      </div>
    </div>
  )
}
