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
    title: `Resorts in ${cityName}`,
    description: `Compare and book resorts in ${cityName}. Verified availability, instant confirmation.`,
    alternates: { canonical: `/resorts-in/${city}` },
  }
}

export default async function ResortsListingPage({ params, searchParams }: ListingPageProps) {
  const [{ city }, rawSearch] = await Promise.all([params, searchParams])

  return <CityListingPage city={city} propertyType="resort" rawSearch={rawSearch} />
}
