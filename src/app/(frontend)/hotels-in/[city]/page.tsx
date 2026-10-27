import type { Metadata } from 'next'

import { CityListingPage } from '@/features/search/components/city-listing-page'

interface ListingPageProps {
  params: Promise<{ city: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { city } = await params
  const cityName = decodeURIComponent(city)
  return {
    title: `Hotels in ${cityName}`,
    description: `Compare and book hotels and resorts in ${cityName}. Verified availability, instant confirmation.`,
    alternates: { canonical: `/hotels-in/${city}` },
  }
}

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  const [{ city }, rawSearch] = await Promise.all([params, searchParams])

  return <CityListingPage city={city} propertyType="hotel" rawSearch={rawSearch} />
}
